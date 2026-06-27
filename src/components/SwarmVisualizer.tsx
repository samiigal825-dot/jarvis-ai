'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, MarkerType, useNodesState, useEdgesState, ConnectionLineType } from 'reactflow';
import 'reactflow/dist/style.css';

interface SwarmVisualizerProps {
  activeAgent: string; // 'JARVIS', 'Manager', 'Coder', 'Verifier', 'None'
}

const initialNodes: Node[] = [
  {
    id: 'jarvis',
    position: { x: 250, y: 50 },
    data: { label: '🤖 CEO JARVIS' },
    style: { background: '#101014', color: '#fff', border: '1px solid #3b82f6', borderRadius: '8px', padding: '10px 20px', fontWeight: 'bold' }
  },
  {
    id: 'manager',
    position: { x: 250, y: 150 },
    data: { label: '📊 Manager' },
    style: { background: '#101014', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 20px' }
  },
  {
    id: 'coder',
    position: { x: 100, y: 250 },
    data: { label: '💻 Coder (Expert)' },
    style: { background: '#101014', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 20px' }
  },
  {
    id: 'verifier',
    position: { x: 400, y: 250 },
    data: { label: '✅ Verifier (QA)' },
    style: { background: '#101014', color: '#a1a1aa', border: '1px solid #3f3f46', borderRadius: '8px', padding: '10px 20px' }
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'jarvis', target: 'manager', animated: false, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e2-3', source: 'manager', target: 'coder', animated: false, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e2-4', source: 'manager', target: 'verifier', animated: false, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e3-4', source: 'coder', target: 'verifier', animated: false, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e4-1', source: 'verifier', target: 'jarvis', type: 'step', animated: false, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
];

export function SwarmVisualizer({ activeAgent }: SwarmVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    // Update node styles based on active agent
    setNodes(nds =>
      nds.map(node => {
        const isActive = node.id === activeAgent.toLowerCase();
        let border = '#3f3f46';
        let color = '#a1a1aa';
        let glow = 'none';
        
        if (isActive) {
          border = '#10b981'; // success/active color
          color = '#fff';
          glow = '0 0 10px rgba(16, 185, 129, 0.5)';
        } else if (activeAgent.toLowerCase() === 'jarvis' && node.id === 'jarvis') {
          border = '#3b82f6';
          color = '#fff';
          glow = '0 0 10px rgba(59, 130, 246, 0.5)';
        }
        
        return {
          ...node,
          style: { ...node.style, border: \`1px solid \${border}\`, color, boxShadow: glow }
        };
      })
    );

    // Update edge animations
    setEdges(eds =>
      eds.map(edge => {
        let isAnimated = false;
        let edgeColor = '#3f3f46';
        
        if (activeAgent.toLowerCase() === 'manager' && edge.source === 'jarvis') {
          isAnimated = true; edgeColor = '#3b82f6';
        } else if (activeAgent.toLowerCase() === 'coder' && edge.source === 'manager') {
          isAnimated = true; edgeColor = '#10b981';
        } else if (activeAgent.toLowerCase() === 'verifier' && edge.source === 'coder') {
          isAnimated = true; edgeColor = '#10b981';
        } else if (activeAgent.toLowerCase() === 'jarvis' && edge.source === 'verifier') {
          isAnimated = true; edgeColor = '#10b981';
        }

        return {
          ...edge,
          animated: isAnimated,
          style: { stroke: edgeColor, strokeWidth: isAnimated ? 2 : 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor }
        };
      })
    );
  }, [activeAgent, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--background)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{color: 'var(--accent)'}}>●</span> Swarm Visualizer
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: {activeAgent === 'None' ? 'Idle' : \`\${activeAgent} Working\`}</span>
      </div>
      <div style={{ width: '100%', height: 'calc(100% - 45px)' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#3f3f46" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
