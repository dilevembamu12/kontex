'use client';
/// @justify: any pour callbacks D3 incompatibles avec TypeScript strict

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { KontExNode, KontExLink } from '@/lib/api';

interface Props { readonly nodes: KontExNode[]; readonly links: KontExLink[]; }

const KIND_COLORS: Record<string, string> = {
  fact: '#a855f7', rule: '#3b82f6', code: '#22c55e', documentation: '#eab308',
};

export default function TtcGraph({ nodes, links }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = svgRef.current.clientWidth || 800;
    const height = 500;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead').attr('viewBox', '0 -5 10 10')
      .attr('refX', 20).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#52525b');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simNodes: any[] = nodes.map(n => ({ ...n }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simLinks: any[] = links.map(l => ({ ...l, source: l.sourceId, target: l.targetId }));

    const simulation = d3.forceSimulation(simNodes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const link = svg.append('g').selectAll('line').data(simLinks).join('line')
      .attr('stroke', '#52525b')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('stroke-width', (d: any) => Math.max(d.weight * d.relevanceScore * 3, 0.5))
      .attr('stroke-opacity', 0.6).attr('marker-end', 'url(#arrowhead)');

    const node = svg.append('g').selectAll('g').data(simNodes).join('g')
      .attr('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }) as never);

    node.append('circle').attr('r', (d: any) => 8 + d.weight * 12)
      .attr('fill', (d: any) => KIND_COLORS[d.kind] ?? '#6b7280').attr('stroke', '#18181b').attr('stroke-width', 2);

    node.append('text').text((d: any) => d.content.slice(0, 25) + (d.content.length > 25 ? '…' : ''))
      .attr('x', 14).attr('y', 4).attr('font-size', 10).attr('fill', '#9ca3af').attr('font-family', 'monospace');

    node.append('title').text((d: any) => `${d.kind}: ${d.content}\nPoids: ${d.weight}\nAmbigüité: ${d.ambiguity}\nAncres: ${d.anchors.length}`);

    simulation.on('tick', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, links]);

  if (nodes.length === 0) return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
      <p className="text-gray-500 text-sm">Ajoutez des nœuds et des liens pour visualiser la toile.</p>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-400 mb-2 px-2">🔗 Graphe de la Toile</h3>
      <svg ref={svgRef} className="w-full" style={{ minHeight: 500 }} />
      <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
        {Object.entries(KIND_COLORS).map(([kind, color]) => (
          <span key={kind} className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: color }} />{kind}</span>
        ))}
      </div>
    </div>
  );
}
