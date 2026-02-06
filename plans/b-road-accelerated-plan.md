# B-Road: Accelerated 3-Week Implementation Plan (March Demo)

**Target Demo Date**: End of March 2025
**Development Capacity**: Full-time (40+ hours/week)
**Current Status**: Week 1 Complete - LLM Chat Integration Working

---

## Progress Update (February 6, 2026)

**Branch:** `feature/llm-chat-integration` (PR #16)

### Week 1 Status: COMPLETE

All Phase 1 and Phase 2 tasks completed:
- Backend: Claude service, query builder, /chat/search endpoint
- Frontend: Chat UI, API client, map highlighting
- See `plans/llm-chat-handoff-summary.md` for full details

---

## Executive Summary

### MVP Goals (March Demo)
1. **Conversational Search** - Ask Claude to find twisty roads
2. **Visual Results** - See roads highlighted on map  
3. **Route Building** - Click roads to build custom routes
4. **Save & Share** - Public route library (no auth)

### What Makes B-Road Different
- **Natural language search** (vs manual map browsing)
- **AI-powered recommendations** (vs static filters)
- **Route building** (vs single road discovery)
- **PostGIS backend** (scalable, fast)

---

## 3-WEEK TIMELINE

### WEEK 1: LLM Integration (Days 1-7) - COMPLETE
**Goal**: Can search roads conversationally and see results on map

**Monday-Tuesday** (Days 1-2): Backend Foundation
- [x] Phase 1.1: Environment setup (30 min)
- [x] Phase 1.2: Claude integration test (45 min)
- [x] Phase 1.3: Query builder utility (1 hour)
- [x] Phase 1.4: Natural language → SQL filters (1.5 hours)
- [x] Phase 1.5: Connect filters to database (2 hours)

**Wednesday-Thursday** (Days 3-4): Chat Interface
- [x] Phase 2.1: Chat UI component stub (45 min)
- [x] Phase 2.2: Message display (1 hour)
- [x] Phase 2.3: Input handling with mock responses (1 hour)
- [x] Phase 2.4: Connect to real API (1.5 hours)

**Friday-Sunday** (Days 5-7): Integration & Polish
- [x] Phase 2.5: Highlight results on map (2 hours)
- [x] Polish chat UI styling (2 hours)
- [x] Add loading states and error handling (1 hour)
- [x] Testing with various queries (2 hours)

**Week 1 Milestone**: Demo conversational search working end-to-end - ACHIEVED

---

### WEEK 2: Route Building (Days 8-14) - PENDING
**Goal**: Can build and save custom routes

**Monday-Tuesday** (Days 8-9): Route State
- [ ] Phase 5.1: Route state management (1 hour)
- [ ] Phase 5.2: Route builder UI panel (2 hours)
- [ ] Visual testing and refinement (1 hour)

**Wednesday-Thursday** (Days 10-11): Click-to-Add
- [ ] Phase 5.3: Click map segments to add to route (2 hours)
- [ ] Add route visualization on map (2 hours)
- [ ] Toast notifications and feedback (1 hour)

**Friday-Saturday** (Days 12-13): Database Persistence
- [ ] Phase 6.1: Routes database schema (1 hour)
- [ ] Phase 6.1: Routes API endpoints (2 hours)
- [ ] Phase 6.2: Save route dialog UI (2 hours)
- [ ] Phase 6.2: Connect save functionality (1 hour)

**Sunday** (Day 14): Saved Routes
- [ ] Phase 6.3: Saved routes list UI (1.5 hours)
- [ ] Load route onto map (2 hours)
- [ ] Testing and bug fixes (2 hours)

**Week 2 Milestone**: Can build, save, and load routes

---

### WEEK 3: Polish & Demo Prep (Days 15-21) - PENDING
**Goal**: Production-ready demo

**Monday-Tuesday** (Days 15-16): Enhanced LLM
- [ ] Phase 3.1: Context-aware responses (2 hours)
- [ ] Phase 3.2: Conversation history (2 hours)
- [ ] Refine prompts for better results (2 hours)

**Wednesday-Thursday** (Days 17-18): Google Maps Integration
- [ ] Phase 4.1: Street View preview button (1 hour)
- [ ] Phase 4.2: Google Maps navigation links (1.5 hours)
- [ ] Test both features (1 hour)

**Friday-Saturday** (Days 19-20): Bug Fixes & Performance
- [ ] Fix any outstanding bugs (4 hours)
- [ ] Performance optimization (2 hours)
- [ ] Mobile responsive improvements (2 hours)
- [ ] Cross-browser testing (2 hours)

**Sunday** (Day 21): Demo Preparation
- [ ] Create demo routes across multiple states (2 hours)
- [ ] Write demo script and talking points (1 hour)
- [ ] Record demo video backup (1 hour)
- [ ] Final testing and polish (2 hours)

**Week 3 Milestone**: Production demo ready

---

## Phase-by-Phase Implementation Details

### PHASE 1: Backend LLM Foundation

#### 1.1: Environment Setup (30 min)
**Files to modify**: `api/requirements.txt`, `api/.env`, `api/server.py`

```bash
# Add Anthropic SDK
cd api
pip install anthropic
echo "anthropic" >> requirements.txt
```

Add to `.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

Create `api/routers/chat.py`:
```python
from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])

@router.get("/health")
async def chat_health():
    return {"status": "ok", "service": "chat"}
```

Register in `api/server.py`:
```python
from routers import chat
app.include_router(chat.router)
```

**Test**: `curl http://localhost:8000/chat/health`  
**Commit**: `git commit -m "feat: add chat endpoint stub"`

---

#### 1.2: Claude Integration Test (45 min)
**Files to create**: `api/services/claude_service.py`

```python
import anthropic
import os

class ClaudeService:
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    
    async def send_message(self, message: str) -> str:
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": message}]
        )
        return response.content[0].text
```

Add test endpoint in `api/routers/chat.py`:
```python
from services.claude_service import ClaudeService

@router.post("/test")
async def test_chat(message: str):
    service = ClaudeService()
    response = await service.send_message(message)
    return {"response": response}
```

**Test**: `curl -X POST "http://localhost:8000/chat/test?message=Hello"`  
**Commit**: `git commit -m "feat: add basic Claude integration"`

---

#### 1.3: Query Builder Utility (1 hour)
**Files to create**: `api/services/query_builder.py`

```python
from typing import Dict, Any, Optional

class CurvatureQueryBuilder:
    """Builds SQL filters from structured parameters"""
    
    @staticmethod
    def build_filters(
        min_curvature: Optional[int] = None,
        max_curvature: Optional[int] = None,
        min_length: Optional[float] = None,
        surface_types: Optional[list[str]] = None,
        sources: Optional[list[str]] = None
    ) -> Dict[str, Any]:
        filters = {}
        if min_curvature:
            filters['min_curvature'] = min_curvature
        if max_curvature:
            filters['max_curvature'] = max_curvature
        if min_length:
            filters['min_length'] = min_length
        if surface_types:
            filters['surface_types'] = surface_types
        if sources:
            filters['sources'] = sources
        return filters
```

Add test endpoint:
```python
@router.post("/build-query")
async def build_query(
    min_curvature: Optional[int] = None,
    max_curvature: Optional[int] = None
):
    builder = CurvatureQueryBuilder()
    filters = builder.build_filters(
        min_curvature=min_curvature,
        max_curvature=max_curvature
    )
    return {"filters": filters}
```

**Test**: `curl -X POST "http://localhost:8000/chat/build-query?min_curvature=5000"`  
**Commit**: `git commit -m "feat: add query builder utility"`

---

#### 1.4: Natural Language → Filters (1.5 hours)
**Files to modify**: `api/services/claude_service.py`

Add system prompt and extraction method:
```python
SYSTEM_PROMPT = """You are a helpful assistant that extracts road search parameters.

Extract these if mentioned:
- min_curvature: minimum curvature score (number)
- max_curvature: maximum curvature score (number)
- min_length: minimum road length in miles (number)
- max_length: maximum road length in miles (number)
- surface_types: road surfaces (list: paved, asphalt, gravel)
- location: general area (string)

Respond ONLY with JSON. Omit parameters not mentioned.

Examples:
Input: "Find twisty roads over 5000 curvature in Vermont"
Output: {"min_curvature": 5000, "location": "Vermont"}

Input: "Show me short curvy roads with good pavement"
Output: {"min_curvature": 3000, "max_length": 10, "surface_types": ["paved", "asphalt"]}
"""

async def extract_filters(self, user_query: str) -> dict:
    response = self.client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_query}]
    )
    
    import json
    try:
        return json.loads(response.content[0].text)
    except json.JSONDecodeError:
        return {}
```

Add endpoint:
```python
@router.post("/extract-filters")
async def extract_filters(query: str):
    service = ClaudeService()
    filters = await service.extract_filters(query)
    return {"query": query, "extracted_filters": filters}
```

**Test**: `curl -X POST "http://localhost:8000/chat/extract-filters" -H "Content-Type: application/json" -d '{"query": "Find epic twisty roads over 8000"}'`  
**Commit**: `git commit -m "feat: add NL to filters extraction"`

---

#### 1.5: Connect to Database (2 hours)
**Files to modify**: Existing `api/services/curvature_service.py`

Add search method (extend existing service):
```python
async def search_by_filters(
    self,
    filters: Dict[str, Any],
    limit: int = 20
) -> List[Dict]:
    """Search segments using flexible filters"""
    query = self.session.query(CurvatureSegment)
    
    if 'min_curvature' in filters:
        query = query.filter(
            CurvatureSegment.curvature >= filters['min_curvature']
        )
    
    if 'max_curvature' in filters:
        query = query.filter(
            CurvatureSegment.curvature <= filters['max_curvature']
        )
    
    if 'min_length' in filters:
        min_meters = filters['min_length'] * 1609.34
        query = query.filter(
            CurvatureSegment.length >= min_meters
        )
    
    if 'sources' in filters:
        query = query.filter(
            CurvatureSegment.source.in_(filters['sources'])
        )
    
    query = query.order_by(CurvatureSegment.curvature.desc())
    results = query.limit(limit).all()
    return [self._segment_to_dict(r) for r in results]
```

Create unified search endpoint:
```python
@router.post("/search")
async def chat_search(query: str, limit: int = 10):
    """Natural language road search"""
    claude_service = ClaudeService()
    filters = await claude_service.extract_filters(query)
    
    curv_service = CurvatureService()
    results = await curv_service.search_by_filters(filters, limit)
    
    return {
        "query": query,
        "filters": filters,
        "results": results,
        "count": len(results)
    }
```

**Test**: `curl -X POST "http://localhost:8000/chat/search" -H "Content-Type: application/json" -d '{"query": "Find super twisty roads"}'`  
**Verify**: Actual road segments returned  
**Commit**: `git commit -m "feat: connect NL search to database"`

---

### PHASE 2: Chat Interface

#### 2.1: Chat Component Stub (45 min)
**Files to create**: `frontend/components/ChatInterface.tsx`

```typescript
'use client';
import { useState } from 'react';

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700"
      >
        💬
      </button>
      
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 h-[500px] bg-white rounded-lg shadow-xl">
          <div className="p-4">
            <h3 className="font-bold">Road Discovery Chat</h3>
            <p className="text-sm text-gray-600">Coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

Add to main page (`frontend/app/page.tsx`):
```typescript
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <>
      {/* Existing map component */}
      <MapComponent />
      
      {/* New chat interface */}
      <ChatInterface />
    </>
  );
}
```

**Test**: Open app, click chat button, verify panel opens/closes  
**Commit**: `git commit -m "feat: add chat UI stub"`

---

#### 2.2: Message Display (1 hour)
**Files to modify**: `frontend/components/ChatInterface.tsx`

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! Ask me to find twisty roads in any region.',
      timestamp: new Date()
    }
  ]);
  
  return (
    // ... button code ...
    {isOpen && (
      <div className="absolute bottom-16 right-0 w-96 h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-bold">Road Discovery</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t">
          <input
            type="text"
            placeholder="Describe your perfect drive..."
            className="w-full p-2 border rounded"
            disabled
          />
        </div>
      </div>
    )}
  );
}
```

**Test**: Verify initial message displays with correct styling  
**Commit**: `git commit -m "feat: add chat message display"`

---

#### 2.3: Input Handling (1 hour)
**Files to modify**: `frontend/components/ChatInterface.tsx`

```typescript
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);

const handleSend = () => {
  if (!input.trim()) return;
  
  const userMessage: Message = {
    role: 'user',
    content: input,
    timestamp: new Date()
  };
  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);
  
  // Mock response
  setTimeout(() => {
    const botMessage: Message = {
      role: 'assistant',
      content: `I'll help you find roads matching: "${input}"`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);
  }, 1000);
};

// Update input JSX
<div className="p-4 border-t flex gap-2">
  <input
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
    placeholder="Describe your perfect drive..."
    className="flex-1 p-2 border rounded"
    disabled={isLoading}
  />
  <button
    onClick={handleSend}
    disabled={isLoading}
    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
  >
    {isLoading ? '...' : 'Send'}
  </button>
</div>
```

**Test**: Type message, press Enter, verify it appears and mock response follows  
**Commit**: `git commit -m "feat: add chat input handling"`

---

#### 2.4: Connect to Real API (1.5 hours)
**Files to create**: `frontend/lib/chat-api.ts`

```typescript
export async function sendChatMessage(query: string) {
  const response = await fetch('http://localhost:8000/chat/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 5 })
  });
  
  if (!response.ok) {
    throw new Error('Chat API error');
  }
  
  return response.json();
}
```

Update `ChatInterface.tsx`:
```typescript
import { sendChatMessage } from '@/lib/chat-api';

const handleSend = async () => {
  if (!input.trim()) return;
  
  const userMessage: Message = {
    role: 'user',
    content: input,
    timestamp: new Date()
  };
  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);
  
  try {
    const data = await sendChatMessage(input);
    
    const resultText = data.results.length > 0
      ? `Found ${data.count} roads:\n\n` +
        data.results.map((r: any) =>
          `• ${r.name || 'Unnamed'} - Curvature: ${r.curvature}`
        ).join('\n')
      : 'No roads found matching your criteria.';
    
    const botMessage: Message = {
      role: 'assistant',
      content: resultText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
  } catch (error) {
    const errorMessage: Message = {
      role: 'assistant',
      content: 'Sorry, there was an error processing your request.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};
```

**Test**: Search for "twisty roads over 5000", verify real results appear  
**Commit**: `git commit -m "feat: connect chat to API"`

---

#### 2.5: Highlight Results on Map (2 hours)
**Files to create**: `frontend/store/map-store.ts`

```typescript
import { create } from 'zustand';

interface MapStore {
  selectedSegments: any[];
  setSelectedSegments: (segments: any[]) => void;
  clearSelectedSegments: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  selectedSegments: [],
  setSelectedSegments: (segments) => set({ selectedSegments: segments }),
  clearSelectedSegments: () => set({ selectedSegments: [] }),
}));
```

Update `ChatInterface.tsx`:
```typescript
import { useMapStore } from '@/store/map-store';

const { setSelectedSegments } = useMapStore();

const handleSend = async () => {
  // ... existing code ...
  const data = await sendChatMessage(input);
  
  if (data.results.length > 0) {
    setSelectedSegments(data.results);
  }
  // ... rest of code ...
};
```

Update map component (`frontend/components/Map.tsx`):
```typescript
import { useMapStore } from '@/store/map-store';
import { useEffect } from 'react';

const { selectedSegments } = useMapStore();

useEffect(() => {
  if (!map || selectedSegments.length === 0) return;
  
  // Remove existing layer
  if (map.getSource('chat-results')) {
    map.removeLayer('chat-results-layer');
    map.removeSource('chat-results');
  }
  
  // Add new layer
  map.addSource('chat-results', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: selectedSegments.map(seg => ({
        type: 'Feature',
        geometry: seg.geometry,
        properties: seg
      }))
    }
  });
  
  map.addLayer({
    id: 'chat-results-layer',
    type: 'line',
    source: 'chat-results',
    paint: {
      'line-color': '#ff0000',
      'line-width': 4
    }
  });
  
  // Fit bounds
  const bounds = new mapboxgl.LngLatBounds();
  selectedSegments.forEach(seg => {
    seg.geometry.coordinates.forEach((coord: any) => {
      bounds.extend(coord);
    });
  });
  map.fitBounds(bounds, { padding: 50 });
  
}, [map, selectedSegments]);
```

**Test**: Search for roads, verify they highlight in red on map  
**Commit**: `git commit -m "feat: highlight chat results on map"`

---

### PHASE 3: Enhanced LLM (Week 3)

#### 3.1: Context-Aware Responses (2 hours)

Update `claude_service.py`:
```python
async def generate_response(
    self,
    user_query: str,
    search_results: List[Dict]
) -> str:
    """Generate natural language response about roads"""
    
    system_prompt = """You are a knowledgeable driving enthusiast assistant.
    
    When showing road results:
    - Describe the character of each road
    - Mention what makes it special
    - Provide context about the region
    - Be enthusiastic but accurate
    
    Curvature scores:
    - 300-1000: Pleasant curves
    - 1000-3000: Very curvy
    - 3000-8000: Highly twisty
    - 8000+: Epic, destination-worthy
    """
    
    results_context = "\n".join([
        f"- {r['name'] or 'Unnamed'}: {r['curvature']} curvature, {r['length']/1609:.1f} miles"
        for r in search_results[:5]
    ])
    
    user_message = f"""User query: {user_query}

Found roads:
{results_context}

Provide a helpful response about these roads."""
    
    response = self.client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}]
    )
    
    return response.content[0].text
```

Update chat endpoint:
```python
@router.post("/search")
async def chat_search(query: str, limit: int = 10):
    claude_service = ClaudeService()
    filters = await claude_service.extract_filters(query)
    
    curv_service = CurvatureService()
    results = await curv_service.search_by_filters(filters, limit)
    
    # Generate conversational response
    response_text = await claude_service.generate_response(query, results)
    
    return {
        "query": query,
        "filters": filters,
        "results": results,
        "response": response_text,
        "count": len(results)
    }
```

Update frontend to use response:
```typescript
const botMessage: Message = {
  role: 'assistant',
  content: data.response, // Use Claude's response
  timestamp: new Date()
};
```

**Test**: Ask "Find amazing twisty roads", verify conversational response  
**Commit**: `git commit -m "feat: add context-aware responses"`

---

## Daily Checklist Template

Copy this for each day of development:

```markdown
## Day X - [Date]

### Goals:
- [ ] Phase X.X: [Task name]
- [ ] Phase X.X: [Task name]

### Completed:
- 

### Blocked/Issues:
- 

### Tomorrow:
- 

### Hours worked: X
```

---

## Demo Script (Week 3)

### 30-Second Pitch
"B-Road uses AI to help you discover the world's best driving roads. Instead of manually browsing maps, just ask Claude to find roads that match your style - whether you want tight hairpins or smooth flowing curves."

### Demo Flow (5 minutes)

**1. Conversational Search** (1 min)
- Show empty map
- Type: "Find epic twisty roads in Vermont"
- Show results highlighted in red
- Explain curvature scoring

**2. Refined Search** (1 min)
- Ask: "Show me the smoothest ones for a sports car"
- Show Claude understands context
- Results update on map

**3. Route Building** (2 min)
- Click 3-4 road segments
- Show route builder panel updating
- Show total distance and curvature
- Save route as "Vermont Grand Tour"

**4. Saved Routes** (1 min)
- Open saved routes list
- Click to load route
- Show it highlights on map
- Mention all routes are public and shareable

### Key Talking Points
- **10+ million road segments** analyzed from OpenStreetMap
- **PostGIS spatial database** for fast queries
- **Claude AI** for natural language understanding
- **No authentication required** for MVP (public routes)
- **Multi-state coverage** (expandable worldwide)

---

## Success Metrics

By end of Week 3, you should have:

- [ ] Working conversational search with Claude
- [ ] Results display on map with highlighting
- [ ] Route builder with click-to-add
- [ ] Save routes to database
- [ ] View saved routes list
- [ ] Load routes back onto map
- [ ] ~50 sample routes saved
- [ ] App loads in under 2 seconds
- [ ] No major bugs
- [ ] Clean, professional UI
- [ ] Works on desktop Chrome/Firefox/Safari

---

## Post-Demo Roadmap (V2)

### High Priority
1. User authentication
2. Private vs public routes
3. GPX export
4. Mobile app (React Native)
5. Route recommendations engine

### Medium Priority
6. Social features (route ratings, comments)
7. Weather integration
8. Traffic overlays
9. Elevation profiles
10. Advanced filtering UI

### Low Priority
11. Route optimization algorithm
12. Community challenges
13. Integration with driving apps
14. Premium features

---

## Getting Help

**Stuck on a phase?**
- Check the original detailed plan for more code samples
- Review B-Road repo CLAUDE.md and API_README.md
- Ask Claude Code for specific implementation help
- Test each component in isolation

**Performance issues?**
- Add database indexes
- Implement request caching
- Optimize map rendering
- Profile with Chrome DevTools

**Bugs?**
- Use git bisect to find breaking commit
- Check browser console for errors
- Test in different browsers
- Verify API responses with curl

---

## Let's Get Started!

### Pre-work Checklist
- [ ] Read this entire plan
- [ ] Verify B-Road app runs locally
- [ ] Get Anthropic API key
- [ ] Set up git branch strategy
- [ ] Create daily journal file

### Your First Task (Right Now)
**Start Phase 1.1** - Should take 30 minutes

1. Add Anthropic to requirements
2. Add API key to .env
3. Create chat router
4. Test health endpoint
5. Commit changes

**When you're done with Phase 1.1, let me know and we'll tackle Phase 1.2 together!**

Good luck! You've got this. 🚗💨
