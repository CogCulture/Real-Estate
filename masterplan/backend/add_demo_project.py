import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "masterplan.db")

demo_project = {
    "id": "demo-project-id",
    "name": "Pre-Configured Site Demo",
    "description": "A pre-configured master plan design with zones, roads, and amenities ready for 3D preview and rendering.",
    "location_name": "Sector 45, Gurugram",
    "lat": 28.4595,
    "lng": 77.0266,
    "site_width": 500.0,
    "site_height": 300.0,
    "site_area": 150000.0,
    "boundary_geojson": None
}

scale = 2.4  # scale_px_per_m for 1200px width

# Pre-defined layout components
demo_layout = {
    "version": "1.0",
    "project_id": "demo-project-id",
    "meta": {
        "site_width_m": 500,
        "site_height_m": 300,
        "canvas_width_px": 1200,
        "canvas_height_px": 720,
        "scale_px_per_m": 2.4,
        "north_angle_deg": 0,
        "total_area_sqm": 150000
    },
    "zones": [
        {
            "id": "zone_res_a",
            "type": "residential",
            "label": "Residential Phase 1",
            "x_px": 120,
            "y_px": 120,
            "width_px": 360,
            "height_px": 240,
            "x_m": 50.0,
            "y_m": 50.0,
            "width_m": 150.0,
            "height_m": 100.0,
            "floors": 4,
            "color": "#4A90D9",
            "opacity": 0.8,
            "rotation_deg": 0,
            "properties": {
                "plot_size_sqm": 15000,
                "setback_front_m": 3.0,
                "setback_side_m": 1.5,
                "ground_coverage_pct": 60,
                "fsi": 1.5
            }
        },
        {
            "id": "zone_res_b",
            "type": "residential",
            "label": "Residential Phase 2",
            "x_px": 600,
            "y_px": 120,
            "width_px": 360,
            "height_px": 240,
            "x_m": 250.0,
            "y_m": 50.0,
            "width_m": 150.0,
            "height_m": 100.0,
            "floors": 4,
            "color": "#4A90D9",
            "opacity": 0.8,
            "rotation_deg": 0,
            "properties": {
                "plot_size_sqm": 15000,
                "setback_front_m": 3.0,
                "setback_side_m": 1.5,
                "ground_coverage_pct": 60,
                "fsi": 1.5
            }
        },
        {
            "id": "zone_comm",
            "type": "commercial",
            "label": "Commercial Core",
            "x_px": 120,
            "y_px": 480,
            "width_px": 288,
            "height_px": 192,
            "x_m": 50.0,
            "y_m": 200.0,
            "width_m": 120.0,
            "height_m": 80.0,
            "floors": 6,
            "color": "#F5A623",
            "opacity": 0.8,
            "rotation_deg": 0,
            "properties": {
                "plot_size_sqm": 9600,
                "setback_front_m": 4.0,
                "setback_side_m": 2.0,
                "ground_coverage_pct": 70,
                "fsi": 2.5
            }
        }
    ],
    "roads": [
        {
            "id": "road_main",
            "type": "primary",
            "label": "Central Avenue",
            "points_px": [[24, 384], [1176, 384]],
            "points_m": [[10.0, 160.0], [490.0, 160.0]],
            "width_px": 24.0,
            "width_m": 10.0,
            "color": "#5D6D7E",
            "has_median": True,
            "median_width_m": 2.0
        },
        {
            "id": "road_service",
            "type": "secondary",
            "label": "Link Road",
            "points_px": [[528, 24], [528, 696]],
            "points_m": [[220.0, 10.0], [220.0, 290.0]],
            "width_px": 14.4,
            "width_m": 6.0,
            "color": "#7F8C8D",
            "has_median": False,
            "median_width_m": 0
        }
      ],
      "amenities": [
        {
            "id": "amenity_park",
            "type": "park",
            "label": "Central Park",
            "x_px": 600,
            "y_px": 408,
            "width_px": 288,
            "height_px": 192,
            "x_m": 250.0,
            "y_m": 170.0,
            "width_m": 120.0,
            "height_m": 80.0
        },
        {
            "id": "amenity_lake",
            "type": "water_body",
            "label": "East Lake",
            "x_px": 960,
            "y_px": 480,
            "width_px": 192,
            "height_px": 192,
            "x_m": 400.0,
            "y_m": 200.0,
            "width_m": 80.0,
            "height_m": 80.0
        }
      ],
      "labels": [
        {
            "id": "lbl_res_a",
            "text": "RESIDENTIAL ZONE A",
            "x_px": 180,
            "y_px": 150,
            "font_size": 14,
            "color": "#ffffff"
        },
        {
            "id": "lbl_res_b",
            "text": "RESIDENTIAL ZONE B",
            "x_px": 660,
            "y_px": 150,
            "font_size": 14,
            "color": "#ffffff"
        },
        {
            "id": "lbl_comm",
            "text": "COMMERCIAL CORE",
            "x_px": 160,
            "y_px": 520,
            "font_size": 14,
            "color": "#ffffff"
        },
        {
            "id": "lbl_park",
            "text": "CENTRAL GREEN PARK",
            "x_px": 640,
            "y_px": 450,
            "font_size": 14,
            "color": "#ffffff"
        }
      ]
}

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Insert project
    cursor.execute("""
    INSERT OR REPLACE INTO projects (id, name, description, location_name, lat, lng, site_width, site_height, site_area)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        demo_project["id"], demo_project["name"], demo_project["description"],
        demo_project["location_name"], demo_project["lat"], demo_project["lng"],
        demo_project["site_width"], demo_project["site_height"], demo_project["site_area"]
    ))
    
    # Insert layout version 1
    cursor.execute("""
    INSERT OR REPLACE INTO layouts (id, project_id, version, layout_json, canvas_width, canvas_height, scale_factor)
    VALUES (?, ?, 1, ?, ?, ?, ?)
    """, (
        "demo-layout-id",
        demo_project["id"],
        json.dumps(demo_layout),
        demo_layout["meta"]["canvas_width_px"],
        demo_layout["meta"]["canvas_height_px"],
        demo_layout["meta"]["scale_px_per_m"]
    ))
    
    conn.commit()
    conn.close()
    print("Demo project 'Pre-Configured Site Demo' populated successfully in masterplan.db.")

if __name__ == "__main__":
    main()
