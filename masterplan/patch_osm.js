const fs = require('fs');
let c = fs.readFileSync('frontend/src/components/editor/Canvas2D.jsx', 'utf8');

c = c.replace(
  /const overpassUrl = 'https:\/\/overpass-api\.de\/api\/interpreter';/g,
  `const cacheKey = \`osm_roads_\${bboxQuery}_\${scale}\`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setOsmRoads(JSON.parse(cached));
          return;
        }
        const overpassUrl = 'https://overpass-api.de/api/interpreter';`
);

c = c.replace(
  /setOsmRoads\(ways\);\s*\} catch \(err\)/g,
  `setOsmRoads(ways);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(ways));
        } catch (e) {} // ignore quota errors
      } catch (err)`
);

fs.writeFileSync('frontend/src/components/editor/Canvas2D.jsx', c);
