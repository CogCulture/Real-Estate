// layoutExporter.js

export function exportLayoutToJSON(projectId, zones, roads, amenities, labels, meta) {
  return {
    version: "1.0",
    project_id: projectId,
    meta: {
      site_width_m: meta.site_width_m,
      site_height_m: meta.site_height_m,
      canvas_width_px: meta.canvas_width_px,
      canvas_height_px: meta.canvas_height_px,
      scale_px_per_m: meta.scale_px_per_m,
      north_angle_deg: meta.north_angle_deg || 0,
      total_area_sqm: meta.total_area_sqm,
      boundary_layers: meta.boundary_layers || [],
      overlap_priorities: meta.overlap_priorities || {}
    },
    zones: zones.map(z => ({
      id: z.id,
      type: z.type,
      label: z.label,
      x_px: z.x_px,
      y_px: z.y_px,
      width_px: z.width_px,
      height_px: z.height_px,
      x_m: z.x_m,
      y_m: z.y_m,
      width_m: z.width_m,
      height_m: z.height_m,
      floors: z.floors || 1,
      color: z.color,
      opacity: z.opacity || 0.8,
      rotation_deg: z.rotation_deg || 0,
      footprint: z.footprint || 'rectangular',
      points_px: z.points_px,
      points_m: z.points_m,
      properties: z.properties || {}
    })),
    roads: roads.map(r => ({
      id: r.id,
      type: r.type,
      label: r.label,
      points_px: r.points_px,
      points_m: r.points_m,
      width_px: r.width_px,
      width_m: r.width_m,
      color: r.color,
      has_median: r.has_median || false,
      median_width_m: r.median_width_m || 0,
      sharp_corners: r.sharp_corners || false,
      tension: r.tension || 0,
      closed: r.closed || false
    })),
    amenities: amenities.map(a => ({
      id: a.id,
      type: a.type,
      label: a.label,
      x_px: a.x_px,
      y_px: a.y_px,
      width_px: a.width_px,
      height_px: a.height_px,
      x_m: a.x_m,
      y_m: a.y_m,
      width_m: a.width_m,
      height_m: a.height_m,
      rotation_deg: a.rotation_deg || 0,
      rotation: a.rotation || 0,
      shape: a.shape || 'rectangular',
      properties: a.properties || {},
      access_variant: a.access_variant,
      tree_variant: a.tree_variant,
      density: a.density,
      points_px: a.points_px,
      points_m: a.points_m
    })),
    labels: labels.map(l => ({
      id: l.id,
      text: l.text,
      x_px: l.x_px,
      y_px: l.y_px,
      font_size: l.font_size || 14,
      color: l.color || '#000000'
    }))
  };
}
