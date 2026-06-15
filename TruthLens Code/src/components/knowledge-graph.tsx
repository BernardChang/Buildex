import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface GraphData {
  nodes: { id: string; title: string; score?: number }[];
  edges: { source: string; target: string; type: "agreement" | "contradiction" | "weak"; note?: string }[];
}

const EDGE_STYLE: Record<string, { stroke: string; label: string }> = {
  agreement: { stroke: "#16a34a", label: "agrees" },
  contradiction: { stroke: "#dc2626", label: "contradicts" },
  weak: { stroke: "#9ca3af", label: "weak link" },
};

export function KnowledgeGraph({ graph }: { graph: GraphData }) {
  const { nodes, edges } = useMemo(() => {
    const n = graph.nodes ?? [];
    const cx = 0;
    const cy = 0;
    const radius = Math.max(180, n.length * 60);
    const rfNodes: Node[] = n.map((node, i) => {
      const angle = (i / Math.max(1, n.length)) * Math.PI * 2;
      return {
        id: node.id,
        position: {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        },
        data: { label: <NodeBody title={node.title} score={node.score} /> },
        style: {
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 12,
          width: 220,
          color: "var(--color-foreground)",
        },
      };
    });

    const rfEdges: Edge[] = (graph.edges ?? []).map((e, i) => {
      const style = EDGE_STYLE[e.type] ?? EDGE_STYLE.weak;
      return {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        animated: e.type === "contradiction",
        label: e.note || style.label,
        labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
        labelBgStyle: { fill: "var(--color-background)" },
        style: { stroke: style.stroke, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph]);

  if (!graph.nodes?.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Not enough papers to render a knowledge graph.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
        <Legend color="#16a34a" label="Agreement" />
        <Legend color="#dc2626" label="Contradiction" />
        <Legend color="#9ca3af" label="Weak / uncertain" />
      </div>
      <div className="h-[560px] rounded-xl border border-border bg-card">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable proOptions={{ hideAttribution: true }}>
          <Background gap={24} size={1} color="var(--color-border)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function NodeBody({ title, score }: { title: string; score?: number }) {
  return (
    <div className="text-left">
      <div className="line-clamp-2 text-xs font-medium leading-snug">{title}</div>
      {typeof score === "number" && (
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums">{score}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-0.5 w-5" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
