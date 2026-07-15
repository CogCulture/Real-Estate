import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { DesignGenome, GenerationResponse, RenderScene, PipelineStage, ProgressEvent } from '../shared/types';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Cache for instant undo/redo
const backendCache = new Map<string, GenerationResponse>();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

app.post('/api/generate', async (req, res) => {
  const genome: DesignGenome = req.body;
  
  // Create deterministc hash
  const genomeHash = crypto.createHash('md5').update(JSON.stringify(genome)).digest('hex');

  if (backendCache.has(genomeHash)) {
    // Instant cache hit for Undo/Redo
    return res.json(backendCache.get(genomeHash));
  }
  
  // Execute Pipeline (Mocking the frozen backend steps for integration testing)
  const stages: PipelineStage[] = ['analysis', 'roads', 'blocks', 'placement', 'constraints', 'optimization', 'composer', 'visualization'];
  let elapsed = 0;
  
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    await sleep(200);
    elapsed += 200;
    
    const progress: ProgressEvent = {
      stage,
      progress: Math.round(((i + 1) / stages.length) * 100),
      generation: stage === 'optimization' ? 50 : 0,
      candidateCount: stage === 'optimization' ? 1200 : 0,
      beamWidth: stage === 'optimization' ? 5 : 0,
      paretoFrontSize: stage === 'optimization' ? 12 : 0,
      elapsedMs: elapsed
    };
    
    io.emit('progress', progress);
  }

  // Construct masterplan output
  const mockScene: RenderScene = {
    background: [], terrain: [], water: [], landscape: [], roads: [], 
    parking: [], pedestrian: [], buildings: [], amenities: [], trees: [], 
    roadMarkings: [], labels: [], shadows: [], debug: []
  };

  mockScene.buildings.push({
    id: `bldg_far_${genome.far_target}`, type: 'Polygon', style: 'Building.Residential',
    points: [{x: 100, y: 100}, {x: 200, y: 100}, {x: 200, y: 200}, {x: 100, y: 200}]
  });

  const response: GenerationResponse = {
    version: "1.0",
    masterplan: {
      id: "mpl_" + genomeHash,
      statistics: {
        far: genome.far_target || 1.5,
        coverage: 0.35,
        saleable_area: 45000,
        open_space: 0.65,
        walkability_score: 92,
        privacy_score: 88
      }
    },
    renderScene: mockScene
  };

  backendCache.set(genomeHash, response);
  res.json(response);
});

httpServer.listen(3000, () => {
  console.log('Backend Pipeline API Server listening on port 3000');
});
