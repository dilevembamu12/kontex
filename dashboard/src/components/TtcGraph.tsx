'use client';
/// TtcGraph — Graphe D3.js ergonomique de la toile TTC
/// Nodes : auto-centrés, zoomable, collision calibrée, viewBox adaptative

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { KontExNode, KontExLink } from '@/lib/api';

interface Props { readonly nodes: KontExNode[]; readonly links: KontExLink[]; }

const KIND_COLORS: Record<string, string> = {
  fact: '#a855f7', rule: '#3b82f6', code: '#22c55e', documentation: '#eab308',
};

export default function TtcGraph({ nodes, links }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = 650;

    // Nettoyer
    container.innerHTML = '';

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#0f172a')
      .style('border-radius', '0 0 8px 8px');

    // Groupe principal pour zoom/pan
    const g = svg.append('g');

    // Zoom + pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => { g.attr('transform', event.transform); });
    svg.call(zoom);

    // Arrowhead markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead').attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#64748b');

    // Préparer données
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simNodes: any[] = nodes.map(n => ({ ...n }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simLinks: any[] = links.map(l => ({ ...l, source: l.sourceId, target: l.targetId }));

    // Simulation avec forces recalibrées
    const simulation = d3.forceSimulation(simNodes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(90).strength(0.7))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(250))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(1.2))
      .force('collision', d3.forceCollide().radius((d: any) => 18 + (d.content?.length || 0) * 0.15))
      .alphaDecay(0.025)
      .alphaMin(0.005); // stopper un peu plus tôt pour éviter oscillations infinies

    // Mise à jour des positions à chaque tick
    simulation.on('tick', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Ajuster le viewBox après que la simulation a tourné suffisamment
    const adjustViewBox = () => {
      const xs = simNodes.map(d => d.x || 0);
      const ys = simNodes.map(d => d.y || 0);
      if (xs.length === 0) return;
      const pad = 70;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      const maxX = Math.max(...xs) + pad;
      const maxY = Math.max(...ys) + pad;
      const vbW = Math.max(maxX - minX, 500);
      const vbH = Math.max(maxY - minY, 400);
      svg.transition().duration(500)
        .attr('viewBox', `${minX} ${minY} ${vbW} ${vbH}`);
    };

    // Double garantie : end event + timeout fallback
    simulation.on('end', adjustViewBox);
    const fallback = setTimeout(adjustViewBox, 4000);

    // Liens
    const link = g.append('g').selectAll('line').data(simLinks).join('line')
      .attr('stroke', '#475569')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('stroke-width', (d: any) => Math.max((d.weight || 0) * (d.relevanceScore || 0) * 4, 1))
      .attr('stroke-opacity', 0.45)
      .attr('marker-end', 'url(#arrowhead)');

    // Nœuds
    const node = g.append('g').selectAll('g').data(simNodes).join('g')
      .attr('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }) as never);

    // Cercles
    node.append('circle')
      .attr('r', (d: any) => 6 + (d.weight || 0.5) * 15)
      .attr('fill', (d: any) => KIND_COLORS[d.kind] ?? '#6b7280')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.92);

    // Labels
    node.append('text')
      .text((d: any) => {
        const label = d.content || '';
        return label.length > 30 ? label.slice(0, 28) + '…' : label;
      })
      .attr('x', 16).attr('y', 4)
      .attr('font-size', 11)
      .attr('fill', '#e2e8f0')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', 500)
      .attr('pointer-events', 'none');

    // Tooltip
    node.append('title').text((d: any) =>
      `${d.kind}: ${d.content}\nPoids: ${(d.weight || 0).toFixed(2)}\nAmbigüité: ${(d.ambiguity || 0).toFixed(2)}\nAncres: ${d.anchors?.length || 0}`
    );

    return () => { simulation.stop(); clearTimeout(fallback); };
  }, [nodes, links]);

  if (nodes.length === 0) return (
    <div className="card">
      <div className="card-body text-center text-muted py-5">
        <i className="ti ti-topology-star fs-32 mb-3 d-block opacity-25"></i>
        <p>Ajoutez des nœuds et des liens pour visualiser la toile TTC.</p>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h5 className="card-title mb-0">🔗 Graphe de la Toile</h5>
        <span className="badge bg-soft-primary text-primary">
          {nodes.length} nœuds · {links.length} liens
        </span>
      </div>
      <div className="card-body p-0 bg-dark" style={{ minHeight: 600 }}>
        <div ref={containerRef} className="w-100" style={{ minHeight: 600, cursor: 'grab' }} />
      </div>
      <div className="card-footer">
        <div className="d-flex justify-content-center gap-3 flex-wrap small">
          {Object.entries(KIND_COLORS).map(([kind, color]) => (
            <span key={kind} className="d-flex align-items-center gap-1">
              <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: color }} />
              <span className="text-muted">{kind}</span>
            </span>
          ))}
          <span className="text-muted ms-lg-3 d-none d-lg-inline">🖱️ Molette = zoom · Glisser = pan · Nœud = déplacer</span>
        </div>
      </div>
    </div>
  );
}
