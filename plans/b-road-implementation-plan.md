# B-Road LLM Integration & Feature Development Plan

## Overview
This plan breaks down the implementation into small, independently testable phases. Each step maintains app stability and can be validated before moving forward.

---

## PHASE 1: LLM Integration Foundation (Week 1-2)

### 1.1: Environment Setup & Basic API Endpoint
**Goal**: Add Anthropic API support without affecting existing app

**Steps**:
1. Add Anthropic SDK to backend dependencies
   ```bash
   cd api
   pip install anthropic
   echo "anthropic" >> requirements.txt
   ```

2. Add environment variable to `.env.example` and `.env`
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

3. Create basic chat endpoint stub
   ```python
   # api/routers/chat.py
   from fastapi import APIRouter
   
   router = APIRouter(prefix="/chat", tags=["chat"])
   
   @router.get("/health")
   async def chat_health():
       return {"status": "ok", "service": "chat"}
   ```

4. Register router in main API
   ```python
   # api/server.py
   from routers import chat
   app.include_router(chat.router)
   ```

**Testing**:
- Run `curl http://localhost:8000/chat/health`
- Verify existing endpoints still work
- Commit: "feat: add chat endpoint stub"

**Time**: 30 minutes  
**Risk**: Very low

---

### 1.2: Simple Claude Integration Test
**Goal**: Verify Claude API works in backend without UI

**Steps**:
1. Create chat service
   ```python
   # api/services/claude_service.py
   import anthropic
   import os
   
   class ClaudeService:
       def __init__(self):
           self.client = anthropic.Anthropic(
               api_key=os.getenv("ANTHROPIC_API_KEY")
           )
       
       async def send_message(self, message: str) -> str:
           """Simple test message to Claude"""
           response = self.client.messages.create(
               model="claude-sonnet-4-20250514",
               max_tokens=1024,
               messages=[{
                   "role": "user",
                   "content": message
               }]
           )
           return response.content[0].text
   ```

2. Add test endpoint
   ```python
   # api/routers/chat.py
   from services.claude_service import ClaudeService
   
   @router.post("/test")
   async def test_chat(message: str):
       service = ClaudeService()
       response = await service.send_message(message)
       return {"response": response}
   ```

**Testing**:
- Run: `curl -X POST "http://localhost:8000/chat/test?message=Hello"`
- Verify Claude responds
- Commit: "feat: add basic Claude integration"

**Time**: 45 minutes  
**Risk**: Low (isolated from main app)

---

### 1.3: Database Query Helper
**Goal**: Create helper to convert natural language to SQL filters

**Steps**:
1. Create query builder utility
   ```python
   # api/services/query_builder.py
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
           """Returns dict of filters for SQLAlchemy query"""
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

2. Add test endpoint
   ```python
   # api/routers/chat.py
   from services.query_builder import CurvatureQueryBuilder
   
   @router.post("/build-query")
   async def build_query(
       min_curvature: Optional[int] = None,
       max_curvature: Optional[int] = None,
       min_length: Optional[float] = None
   ):
       builder = CurvatureQueryBuilder()
       filters = builder.build_filters(
           min_curvature=min_curvature,
           max_curvature=max_curvature,
           min_length=min_length
       )
       return {"filters": filters}
   ```

**Testing**:
- Test: `curl -X POST "http://localhost:8000/chat/build-query?min_curvature=3000&min_length=5.0"`
- Verify correct filter dict returned
- Commit: "feat: add query builder utility"

**Time**: 1 hour  
**Risk**: Very low (pure utility, no DB queries yet)

---

### 1.4: Claude Natural Language → Filters
**Goal**: Have Claude extract parameters from natural language

**Steps**:
1. Create prompt template
   ```python
   # api/services/claude_service.py
   
   SYSTEM_PROMPT = """You are a helpful assistant that extracts road search parameters from natural language.

   Extract these parameters if mentioned:
   - min_curvature: minimum curvature score (number)
   - max_curvature: maximum curvature score (number)
   - min_length: minimum road length in miles (number)
   - max_length: maximum road length in miles (number)
   - surface_types: road surface types (list of strings: paved, asphalt, gravel)
   - location: general area (string)
   
   Respond ONLY with a JSON object containing the extracted parameters.
   If a parameter is not mentioned, omit it.
   
   Examples:
   Input: "Find twisty roads over 5000 curvature in Vermont"
   Output: {"min_curvature": 5000, "location": "Vermont"}
   
   Input: "Show me short curvy roads with good pavement"
   Output: {"min_curvature": 3000, "max_length": 10, "surface_types": ["paved", "asphalt"]}
   """
   
   async def extract_filters(self, user_query: str) -> dict:
       """Extract search filters from natural language"""
       response = self.client.messages.create(
           model="claude-sonnet-4-20250514",
           max_tokens=1024,
           system=SYSTEM_PROMPT,
           messages=[{
               "role": "user",
               "content": user_query
           }]
       )
       
       # Parse JSON response
       import json
       try:
           filters = json.loads(response.content[0].text)
           return filters
       except json.JSONDecodeError:
           return {}
   ```

2. Add endpoint to test extraction
   ```python
   # api/routers/chat.py
   
   @router.post("/extract-filters")
   async def extract_filters(query: str):
       service = ClaudeService()
       filters = await service.extract_filters(query)
       return {"query": query, "extracted_filters": filters}
   ```

**Testing**:
- Test: `curl -X POST "http://localhost:8000/chat/extract-filters" -d '{"query": "Find super twisty roads over 8000 curvature in New York"}'`
- Verify: `{"min_curvature": 8000, "location": "New York"}` returned
- Test several queries with different parameters
- Commit: "feat: add NL to filters extraction"

**Time**: 1.5 hours  
**Risk**: Low (no DB queries, just parsing)

---

### 1.5: Connect Filters to Database Query
**Goal**: Use extracted filters to query actual curvature data

**Steps**:
1. Extend existing curvature service
   ```python
   # api/services/curvature_service.py (existing file)
   
   async def search_by_filters(
       self,
       filters: Dict[str, Any],
       limit: int = 20
   ) -> List[Dict]:
       """Search segments using flexible filters"""
       query = self.session.query(CurvatureSegment)
       
       # Apply filters
       if 'min_curvature' in filters:
           query = query.filter(
               CurvatureSegment.curvature >= filters['min_curvature']
           )
       
       if 'max_curvature' in filters:
           query = query.filter(
               CurvatureSegment.curvature <= filters['max_curvature']
           )
       
       if 'min_length' in filters:
           # Convert miles to meters (OSM uses meters)
           min_meters = filters['min_length'] * 1609.34
           query = query.filter(
               CurvatureSegment.length >= min_meters
           )
       
       if 'sources' in filters:
           query = query.filter(
               CurvatureSegment.source.in_(filters['sources'])
           )
       
       # Order by curvature desc
       query = query.order_by(CurvatureSegment.curvature.desc())
       
       results = query.limit(limit).all()
       return [self._segment_to_dict(r) for r in results]
   ```

2. Add chat search endpoint
   ```python
   # api/routers/chat.py
   
   @router.post("/search")
   async def chat_search(query: str, limit: int = 10):
       """Natural language road search"""
       # Extract filters from natural language
       claude_service = ClaudeService()
       filters = await claude_service.extract_filters(query)
       
       # Query database
       curv_service = CurvatureService()
       results = await curv_service.search_by_filters(filters, limit)
       
       return {
           "query": query,
           "filters": filters,
           "results": results,
           "count": len(results)
       }
   ```

**Testing**:
- Test: `curl -X POST "http://localhost:8000/chat/search" -d '{"query": "Find epic twisty roads over 5000"}'`
- Verify actual road segments returned
- Verify filters applied correctly
- Test with different queries
- Commit: "feat: connect NL search to database"

**Time**: 2 hours  
**Risk**: Medium (first DB integration, but read-only)

---

## PHASE 2: Basic Chat UI (Week 2-3)

### 2.1: Chat UI Component Stub
**Goal**: Add chat interface without breaking existing map

**Steps**:
1. Create chat component
   ```typescript
   // frontend/components/ChatInterface.tsx
   'use client';
   
   import { useState } from 'react';
   
   export default function ChatInterface() {
     const [isOpen, setIsOpen] = useState(false);
     
     return (
       <div className="fixed bottom-4 right-4 z-50">
         {/* Floating button */}
         <button
           onClick={() => setIsOpen(!isOpen)}
           className="bg-blue-600 text-white rounded-full p-4 shadow-lg"
         >
           💬
         </button>
         
         {/* Chat panel (hidden initially) */}
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

2. Add to main page
   ```typescript
   // frontend/app/page.tsx
   import ChatInterface from '@/components/ChatInterface';
   
   export default function Home() {
     return (
       <>
         {/* Existing map code */}
         <MapComponent />
         
         {/* New chat interface */}
         <ChatInterface />
       </>
     );
   }
   ```

**Testing**:
- Open app in browser
- Click chat button
- Verify panel opens/closes
- Verify map still works
- Commit: "feat: add chat UI stub"

**Time**: 45 minutes  
**Risk**: Very low (UI only, no functionality)

---

### 2.2: Chat Message Display
**Goal**: Display messages in chat interface

**Steps**:
1. Add message state and UI
   ```typescript
   // frontend/components/ChatInterface.tsx
   
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
           {/* Header */}
           <div className="p-4 border-b">
             <h3 className="font-bold">Road Discovery</h3>
           </div>
           
           {/* Messages */}
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
           
           {/* Input (stub for now) */}
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

**Testing**:
- Open chat
- Verify initial message displays
- Verify styling looks good
- Commit: "feat: add chat message display"

**Time**: 1 hour  
**Risk**: Very low (UI only)

---

### 2.3: Chat Input and Mock Response
**Goal**: Accept user input and show mock response

**Steps**:
1. Add input handling
   ```typescript
   // frontend/components/ChatInterface.tsx
   
   const [input, setInput] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   
   const handleSend = () => {
     if (!input.trim()) return;
     
     // Add user message
     const userMessage: Message = {
       role: 'user',
       content: input,
       timestamp: new Date()
     };
     setMessages(prev => [...prev, userMessage]);
     setInput('');
     setIsLoading(true);
     
     // Mock response after delay
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

**Testing**:
- Type message and press Enter
- Verify user message appears
- Verify mock response appears after 1 second
- Verify input clears
- Commit: "feat: add chat input and mock response"

**Time**: 1 hour  
**Risk**: Low (no API calls yet)

---

### 2.4: Connect Chat to Real API
**Goal**: Send messages to backend and display real results

**Steps**:
1. Create API client function
   ```typescript
   // frontend/lib/chat-api.ts
   
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

2. Update handleSend to use real API
   ```typescript
   // frontend/components/ChatInterface.tsx
   import { sendChatMessage } from '@/lib/chat-api';
   
   const handleSend = async () => {
     if (!input.trim()) return;
     
     // Add user message
     const userMessage: Message = {
       role: 'user',
       content: input,
       timestamp: new Date()
     };
     setMessages(prev => [...prev, userMessage]);
     setInput('');
     setIsLoading(true);
     
     try {
       // Real API call
       const data = await sendChatMessage(input);
       
       // Format response
       const resultText = data.results.length > 0
         ? `Found ${data.count} roads:\n\n` +
           data.results.map((r: any) =>
             `• ${r.name || 'Unnamed road'} - Curvature: ${r.curvature}`
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

**Testing**:
- Start backend: `cd api && uvicorn server:app --reload`
- Start frontend: `cd frontend && npm run dev`
- Type: "Find twisty roads over 5000"
- Verify real results appear
- Test error handling by stopping backend
- Commit: "feat: connect chat to API"

**Time**: 1.5 hours  
**Risk**: Medium (first full integration)

---

### 2.5: Display Results on Map
**Goal**: When chat finds roads, highlight them on map

**Steps**:
1. Create global state for selected roads
   ```typescript
   // frontend/store/map-store.ts (create new)
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

2. Update chat to set selected segments
   ```typescript
   // frontend/components/ChatInterface.tsx
   import { useMapStore } from '@/store/map-store';
   
   const { setSelectedSegments } = useMapStore();
   
   const handleSend = async () => {
     // ... existing code ...
     
     const data = await sendChatMessage(input);
     
     // Highlight on map
     if (data.results.length > 0) {
       setSelectedSegments(data.results);
     }
     
     // ... rest of code ...
   };
   ```

3. Update map to show selected segments
   ```typescript
   // frontend/components/Map.tsx (modify existing)
   import { useMapStore } from '@/store/map-store';
   import { useEffect } from 'react';
   
   const { selectedSegments } = useMapStore();
   
   useEffect(() => {
     if (!map || selectedSegments.length === 0) return;
     
     // Add source for selected segments
     if (map.getSource('chat-results')) {
       map.removeLayer('chat-results-layer');
       map.removeSource('chat-results');
     }
     
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
     
     // Fit bounds to results
     const bounds = new mapboxgl.LngLatBounds();
     selectedSegments.forEach(seg => {
       seg.geometry.coordinates.forEach((coord: any) => {
         bounds.extend(coord);
       });
     });
     map.fitBounds(bounds, { padding: 50 });
     
   }, [map, selectedSegments]);
   ```

**Testing**:
- Search for roads in chat
- Verify roads highlight in red on map
- Verify map zooms to show results
- Verify existing functionality still works
- Commit: "feat: highlight chat results on map"

**Time**: 2 hours  
**Risk**: Medium (modifies map component)

---

## PHASE 3: Enhanced LLM Features (Week 3-4)

### 3.1: Context-Aware Responses
**Goal**: Claude provides conversational context about roads

**Steps**:
1. Enhance Claude prompt with road knowledge
   ```python
   # api/services/claude_service.py
   
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
       - Use driving terminology naturally
       
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

2. Update chat endpoint
   ```python
   # api/routers/chat.py
   
   @router.post("/search")
   async def chat_search(query: str, limit: int = 10):
       # Extract filters and query DB
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

3. Update frontend to show response
   ```typescript
   // frontend/components/ChatInterface.tsx
   
   const botMessage: Message = {
     role: 'assistant',
     content: data.response, // Use Claude's response instead of simple list
     timestamp: new Date()
   };
   ```

**Testing**:
- Ask: "Find amazing twisty roads in Vermont"
- Verify Claude provides conversational response
- Verify response includes context about roads
- Commit: "feat: add context-aware responses"

**Time**: 2 hours  
**Risk**: Low (enhances existing feature)

---

### 3.2: Multi-Turn Conversations
**Goal**: Claude remembers conversation context

**Steps**:
1. Add conversation history to state
   ```typescript
   // frontend/components/ChatInterface.tsx
   
   const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
   ```

2. Update API to accept conversation history
   ```python
   # api/routers/chat.py
   from pydantic import BaseModel
   from typing import List
   
   class ChatMessage(BaseModel):
       role: str
       content: str
   
   class ChatRequest(BaseModel):
       query: str
       history: List[ChatMessage] = []
       limit: int = 10
   
   @router.post("/search")
   async def chat_search(request: ChatRequest):
       # Build full conversation for Claude
       messages = [
           {"role": msg.role, "content": msg.content}
           for msg in request.history[-5:]  # Last 5 messages
       ]
       messages.append({"role": "user", "content": request.query})
       
       # Use history in Claude call
       # ... rest of logic
   ```

3. Update frontend to send history
   ```typescript
   // frontend/lib/chat-api.ts
   
   export async function sendChatMessage(
     query: string,
     history: Message[]
   ) {
     const response = await fetch('http://localhost:8000/chat/search', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         query,
         history: history.slice(-5), // Last 5 messages
         limit: 5
       })
     });
     
     return response.json();
   }
   ```

**Testing**:
- Ask: "Find twisty roads in Vermont"
- Then ask: "What about the smoothest ones?"
- Verify Claude understands context
- Commit: "feat: add conversation history"

**Time**: 2 hours  
**Risk**: Low

---

## PHASE 4: Google Maps Integration (Week 4-5)

### 4.1: Street View Button
**Goal**: Add Street View preview for any road

**Steps**:
1. Add Street View component
   ```typescript
   // frontend/components/StreetViewButton.tsx
   
   interface Props {
     lat: number;
     lng: number;
     roadName?: string;
   }
   
   export default function StreetViewButton({ lat, lng, roadName }: Props) {
     const openStreetView = () => {
       const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
       window.open(url, '_blank');
     };
     
     return (
       <button
         onClick={openStreetView}
         className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
       >
         <span>📍</span>
         <span>Street View</span>
       </button>
     );
   }
   ```

2. Add to road popup/sidebar
   ```typescript
   // frontend/components/RoadDetail.tsx (create or modify)
   
   import StreetViewButton from './StreetViewButton';
   
   export default function RoadDetail({ road }: { road: any }) {
     // Get center point of road
     const centerCoord = road.geometry.coordinates[
       Math.floor(road.geometry.coordinates.length / 2)
     ];
     
     return (
       <div className="p-4">
         <h3 className="font-bold text-lg">{road.name || 'Unnamed Road'}</h3>
         <p className="text-sm text-gray-600">
           Curvature: {road.curvature} | Length: {(road.length / 1609).toFixed(1)} mi
         </p>
         
         <div className="mt-4 flex gap-2">
           <StreetViewButton
             lat={centerCoord[1]}
             lng={centerCoord[0]}
             roadName={road.name}
           />
         </div>
       </div>
     );
   }
   ```

**Testing**:
- Click a road segment
- Click "Street View" button
- Verify Google Street View opens in new tab
- Commit: "feat: add Street View button"

**Time**: 1 hour  
**Risk**: Very low (external link only)

---

### 4.2: Navigate in Google Maps
**Goal**: Generate navigation links for found roads

**Steps**:
1. Create navigation button component
   ```typescript
   // frontend/components/GoogleMapsNavButton.tsx
   
   interface Props {
     waypoints: Array<[number, number]>; // [lng, lat]
     roadName?: string;
   }
   
   export default function GoogleMapsNavButton({ waypoints, roadName }: Props) {
     const openNavigation = () => {
       // Convert waypoints to Google Maps URL format
       const waypointsStr = waypoints
         .map(([lng, lat]) => `${lat},${lng}`)
         .join('/');
       
       const url = `https://www.google.com/maps/dir/${waypointsStr}`;
       window.open(url, '_blank');
     };
     
     return (
       <button
         onClick={openNavigation}
         className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
       >
         <span>🧭</span>
         <span>Navigate</span>
       </button>
     );
   }
   ```

2. Add to chat results
   ```typescript
   // frontend/components/ChatInterface.tsx
   
   // When displaying results, add navigation buttons
   {data.results.length > 0 && (
     <div className="mt-2 space-y-2">
       {data.results.slice(0, 3).map((road, i) => (
         <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
           <span className="text-sm">{road.name || 'Unnamed'}</span>
           <GoogleMapsNavButton
             waypoints={road.geometry.coordinates}
             roadName={road.name}
           />
         </div>
       ))}
     </div>
   )}
   ```

**Testing**:
- Search for roads in chat
- Click "Navigate" button
- Verify Google Maps opens with route
- Commit: "feat: add Google Maps navigation"

**Time**: 1.5 hours  
**Risk**: Low

---

## PHASE 5: Route Building (Week 5-6)

### 5.1: Route State Management
**Goal**: Track roads added to a route

**Steps**:
1. Create route store
   ```typescript
   // frontend/store/route-store.ts
   
   interface RouteSegment {
     id: number;
     name?: string;
     curvature: number;
     length: number;
     geometry: any;
   }
   
   interface RouteStore {
     segments: RouteSegment[];
     addSegment: (segment: RouteSegment) => void;
     removeSegment: (id: number) => void;
     clearRoute: () => void;
     getTotalDistance: () => number;
     getTotalCurvature: () => number;
   }
   
   export const useRouteStore = create<RouteStore>((set, get) => ({
     segments: [],
     
     addSegment: (segment) => set((state) => ({
       segments: [...state.segments, segment]
     })),
     
     removeSegment: (id) => set((state) => ({
       segments: state.segments.filter(s => s.id !== id)
     })),
     
     clearRoute: () => set({ segments: [] }),
     
     getTotalDistance: () => {
       return get().segments.reduce((sum, s) => sum + s.length, 0);
     },
     
     getTotalCurvature: () => {
       return get().segments.reduce((sum, s) => sum + s.curvature, 0);
     }
   }));
   ```

**Testing**:
- Import in component
- Call addSegment with mock data
- Verify state updates
- Commit: "feat: add route state management"

**Time**: 1 hour  
**Risk**: Very low

---

### 5.2: Route Builder UI Panel
**Goal**: Show route being built

**Steps**:
1. Create route panel component
   ```typescript
   // frontend/components/RouteBuilderPanel.tsx
   
   import { useRouteStore } from '@/store/route-store';
   
   export default function RouteBuilderPanel() {
     const {
       segments,
       removeSegment,
       clearRoute,
       getTotalDistance,
       getTotalCurvature
     } = useRouteStore();
     
     const [isOpen, setIsOpen] = useState(true);
     
     if (!isOpen) {
       return (
         <button
           onClick={() => setIsOpen(true)}
           className="fixed left-4 bottom-4 bg-purple-600 text-white px-4 py-2 rounded shadow-lg"
         >
           Route Builder ({segments.length})
         </button>
       );
     }
     
     return (
       <div className="fixed left-4 bottom-4 w-80 max-h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
         {/* Header */}
         <div className="p-4 border-b flex justify-between items-center">
           <h3 className="font-bold">Route Builder</h3>
           <button onClick={() => setIsOpen(false)}>✕</button>
         </div>
         
         {/* Stats */}
         <div className="p-4 bg-gray-50 border-b grid grid-cols-2 gap-4 text-sm">
           <div>
             <div className="text-gray-600">Distance</div>
             <div className="font-bold">{(getTotalDistance() / 1609).toFixed(1)} mi</div>
           </div>
           <div>
             <div className="text-gray-600">Curvature</div>
             <div className="font-bold">{getTotalCurvature().toLocaleString()}</div>
           </div>
         </div>
         
         {/* Segments */}
         <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {segments.length === 0 ? (
             <p className="text-gray-500 text-sm text-center py-8">
               Click roads on the map to add to your route
             </p>
           ) : (
             segments.map((seg, i) => (
               <div key={seg.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                 <div className="flex items-center gap-2">
                   <span className="text-xs text-gray-500">{i + 1}</span>
                   <span className="text-sm">{seg.name || 'Unnamed'}</span>
                 </div>
                 <button
                   onClick={() => removeSegment(seg.id)}
                   className="text-red-600 hover:text-red-800"
                 >
                   ✕
                 </button>
               </div>
             ))
           )}
         </div>
         
         {/* Actions */}
         {segments.length > 0 && (
           <div className="p-4 border-t flex gap-2">
             <button
               onClick={clearRoute}
               className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
             >
               Clear
             </button>
             <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
               Save Route
             </button>
           </div>
         )}
       </div>
     );
   }
   ```

2. Add to main page
   ```typescript
   // frontend/app/page.tsx
   import RouteBuilderPanel from '@/components/RouteBuilderPanel';
   
   return (
     <>
       <MapComponent />
       <ChatInterface />
       <RouteBuilderPanel />
     </>
   );
   ```

**Testing**:
- Open app
- Verify route builder panel appears (empty)
- Commit: "feat: add route builder UI"

**Time**: 2 hours  
**Risk**: Low (UI only)

---

### 5.3: Click to Add Roads to Route
**Goal**: Click map segments to add them to route

**Steps**:
1. Update map click handler
   ```typescript
   // frontend/components/Map.tsx
   import { useRouteStore } from '@/store/route-store';
   
   const { addSegment } = useRouteStore();
   
   useEffect(() => {
     if (!map) return;
     
     map.on('click', 'curvature-layer', (e) => {
       if (!e.features || e.features.length === 0) return;
       
       const feature = e.features[0];
       const segment = {
         id: feature.properties.id,
         name: feature.properties.name,
         curvature: feature.properties.curvature,
         length: feature.properties.length,
         geometry: feature.geometry
       };
       
       addSegment(segment);
       
       // Show visual feedback
       toast.success(`Added ${segment.name || 'road'} to route`);
     });
     
     // Change cursor on hover
     map.on('mouseenter', 'curvature-layer', () => {
       map.getCanvas().style.cursor = 'pointer';
     });
     
     map.on('mouseleave', 'curvature-layer', () => {
       map.getCanvas().style.cursor = '';
     });
     
   }, [map, addSegment]);
   ```

2. Add toast notification library
   ```bash
   cd frontend
   npm install react-hot-toast
   ```

3. Add toast provider
   ```typescript
   // frontend/app/layout.tsx
   import { Toaster } from 'react-hot-toast';
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           {children}
           <Toaster position="top-right" />
         </body>
       </html>
     );
   }
   ```

**Testing**:
- Click road segments on map
- Verify they appear in route builder panel
- Verify stats update
- Verify toast notification appears
- Commit: "feat: click to add roads to route"

**Time**: 2 hours  
**Risk**: Medium (modifies map interaction)

---

## PHASE 6: Route Persistence (Week 6)

### 6.1: Save Route to Database
**Goal**: Store routes in PostgreSQL

**Steps**:
1. Add routes table migration
   ```sql
   -- api/migrations/001_add_routes.sql
   
   CREATE TABLE routes (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     description TEXT,
     total_distance FLOAT,
     total_curvature INTEGER,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE route_segments (
     id SERIAL PRIMARY KEY,
     route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
     segment_id INTEGER REFERENCES curvature_segments(id),
     order_index INTEGER NOT NULL,
     UNIQUE(route_id, order_index)
   );
   
   CREATE INDEX idx_route_segments_route_id ON route_segments(route_id);
   ```

2. Run migration
   ```bash
   psql curvature < api/migrations/001_add_routes.sql
   ```

3. Create route models
   ```python
   # api/models/route.py
   from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
   from sqlalchemy.orm import relationship
   from datetime import datetime
   from .base import Base
   
   class Route(Base):
       __tablename__ = 'routes'
       
       id = Column(Integer, primary_key=True)
       name = Column(String(255), nullable=False)
       description = Column(String)
       total_distance = Column(Float)
       total_curvature = Column(Integer)
       created_at = Column(DateTime, default=datetime.utcnow)
       updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
       
       segments = relationship("RouteSegment", back_populates="route")
   
   class RouteSegment(Base):
       __tablename__ = 'route_segments'
       
       id = Column(Integer, primary_key=True)
       route_id = Column(Integer, ForeignKey('routes.id', ondelete='CASCADE'))
       segment_id = Column(Integer, ForeignKey('curvature_segments.id'))
       order_index = Column(Integer, nullable=False)
       
       route = relationship("Route", back_populates="segments")
       segment = relationship("CurvatureSegment")
   ```

4. Create routes API endpoint
   ```python
   # api/routers/routes.py
   from fastapi import APIRouter, Depends, HTTPException
   from sqlalchemy.orm import Session
   from typing import List
   from pydantic import BaseModel
   
   router = APIRouter(prefix="/routes", tags=["routes"])
   
   class CreateRouteRequest(BaseModel):
       name: str
       description: str = ""
       segment_ids: List[int]
   
   @router.post("/")
   async def create_route(request: CreateRouteRequest, db: Session = Depends(get_db)):
       # Calculate totals
       segments = db.query(CurvatureSegment).filter(
           CurvatureSegment.id.in_(request.segment_ids)
       ).all()
       
       total_distance = sum(s.length for s in segments)
       total_curvature = sum(s.curvature for s in segments)
       
       # Create route
       route = Route(
           name=request.name,
           description=request.description,
           total_distance=total_distance,
           total_curvature=total_curvature
       )
       db.add(route)
       db.flush()
       
       # Add segments
       for i, segment_id in enumerate(request.segment_ids):
           route_segment = RouteSegment(
               route_id=route.id,
               segment_id=segment_id,
               order_index=i
           )
           db.add(route_segment)
       
       db.commit()
       
       return {"id": route.id, "name": route.name}
   
   @router.get("/")
   async def list_routes(db: Session = Depends(get_db)):
       routes = db.query(Route).order_by(Route.created_at.desc()).all()
       return routes
   
   @router.get("/{route_id}")
   async def get_route(route_id: int, db: Session = Depends(get_db)):
       route = db.query(Route).filter(Route.id == route_id).first()
       if not route:
           raise HTTPException(status_code=404, detail="Route not found")
       return route
   ```

5. Register routes router
   ```python
   # api/server.py
   from routers import routes
   app.include_router(routes.router)
   ```

**Testing**:
- Test create: `curl -X POST http://localhost:8000/routes/ -d '{"name": "Test Route", "segment_ids": [1, 2, 3]}'`
- Test list: `curl http://localhost:8000/routes/`
- Verify routes in database: `psql curvature -c "SELECT * FROM routes;"`
- Commit: "feat: add route persistence"

**Time**: 3 hours  
**Risk**: Medium (new database tables)

---

### 6.2: Save Route from UI
**Goal**: Connect save button to API

**Steps**:
1. Create save route dialog
   ```typescript
   // frontend/components/SaveRouteDialog.tsx
   
   interface Props {
     isOpen: boolean;
     onClose: () => void;
     onSave: (name: string, description: string) => void;
   }
   
   export default function SaveRouteDialog({ isOpen, onClose, onSave }: Props) {
     const [name, setName] = useState('');
     const [description, setDescription] = useState('');
     
     const handleSave = () => {
       if (!name.trim()) return;
       onSave(name, description);
       setName('');
       setDescription('');
       onClose();
     };
     
     if (!isOpen) return null;
     
     return (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
         <div className="bg-white rounded-lg p-6 w-96">
           <h3 className="text-lg font-bold mb-4">Save Route</h3>
           
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium mb-1">
                 Route Name *
               </label>
               <input
                 type="text"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="w-full p-2 border rounded"
                 placeholder="My Epic Drive"
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium mb-1">
                 Description
               </label>
               <textarea
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 className="w-full p-2 border rounded"
                 rows={3}
                 placeholder="Optional description..."
               />
             </div>
           </div>
           
           <div className="mt-6 flex gap-2">
             <button
               onClick={onClose}
               className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
             >
               Cancel
             </button>
             <button
               onClick={handleSave}
               disabled={!name.trim()}
               className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
             >
               Save
             </button>
           </div>
         </div>
       </div>
     );
   }
   ```

2. Update route builder panel
   ```typescript
   // frontend/components/RouteBuilderPanel.tsx
   import SaveRouteDialog from './SaveRouteDialog';
   
   const [showSaveDialog, setShowSaveDialog] = useState(false);
   
   const handleSaveRoute = async (name: string, description: string) => {
     const segmentIds = segments.map(s => s.id);
     
     try {
       const response = await fetch('http://localhost:8000/routes/', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           name,
           description,
           segment_ids: segmentIds
         })
       });
       
       if (response.ok) {
         toast.success('Route saved!');
         clearRoute();
       } else {
         toast.error('Failed to save route');
       }
     } catch (error) {
       toast.error('Error saving route');
     }
   };
   
   // Update save button
   <button
     onClick={() => setShowSaveDialog(true)}
     className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
   >
     Save Route
   </button>
   
   <SaveRouteDialog
     isOpen={showSaveDialog}
     onClose={() => setShowSaveDialog(false)}
     onSave={handleSaveRoute}
   />
   ```

**Testing**:
- Add segments to route
- Click "Save Route"
- Enter name and description
- Click Save
- Verify toast success message
- Verify route in database
- Commit: "feat: save routes from UI"

**Time**: 2 hours  
**Risk**: Low

---

### 6.3: Saved Routes List
**Goal**: View and load saved routes

**Steps**:
1. Create saved routes panel
   ```typescript
   // frontend/components/SavedRoutesPanel.tsx
   
   import { useEffect, useState } from 'react';
   
   export default function SavedRoutesPanel() {
     const [routes, setRoutes] = useState([]);
     const [isLoading, setIsLoading] = useState(true);
     
     useEffect(() => {
       loadRoutes();
     }, []);
     
     const loadRoutes = async () => {
       try {
         const response = await fetch('http://localhost:8000/routes/');
         const data = await response.json();
         setRoutes(data);
       } catch (error) {
         console.error('Failed to load routes', error);
       } finally {
         setIsLoading(false);
       }
     };
     
     return (
       <div className="p-4">
         <h3 className="font-bold text-lg mb-4">Saved Routes</h3>
         
         {isLoading ? (
           <p className="text-gray-500">Loading...</p>
         ) : routes.length === 0 ? (
           <p className="text-gray-500">No saved routes yet</p>
         ) : (
           <div className="space-y-2">
             {routes.map((route: any) => (
               <div key={route.id} className="p-3 border rounded hover:bg-gray-50">
                 <h4 className="font-medium">{route.name}</h4>
                 {route.description && (
                   <p className="text-sm text-gray-600">{route.description}</p>
                 )}
                 <div className="mt-2 flex justify-between text-xs text-gray-500">
                   <span>{(route.total_distance / 1609).toFixed(1)} mi</span>
                   <span>{route.total_curvature.toLocaleString()} curvature</span>
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>
     );
   }
   ```

2. Add to sidebar or new tab
   ```typescript
   // Add tab switching in main layout
   ```

**Testing**:
- Open saved routes panel
- Verify saved routes appear
- Verify stats display correctly
- Commit: "feat: add saved routes list"

**Time**: 1.5 hours  
**Risk**: Low

---

## Summary & Timeline

### Total Estimated Time: 6 weeks

**Week 1-2: LLM Foundation**
- Basic API integration ✓
- Natural language to SQL ✓
- Database queries ✓

**Week 2-3: Chat UI**
- Message interface ✓
- Real-time search ✓
- Map integration ✓

**Week 3-4: Enhanced LLM**
- Context-aware responses ✓
- Conversation history ✓

**Week 4-5: Google Maps**
- Street View ✓
- Navigation links ✓

**Week 5-6: Route Building** ✅ COMPLETED (feature/route-builder branch)
- Route state ✓ — `frontend/store/useRouteStore.ts` (Zustand)
- Click to add ✓ — Map.tsx click handler with toast notifications
- Route visualization ✓ — Purple line + numbered markers on map
- Route builder panel ✓ — Sidebar with reorder, remove, stats
- Save route dialog ✓ — Modal with name, description, public toggle
- Saved routes list ✓ — Load, delete, share functionality
- API routers ✓ — `api/routers/routes.py` + `api/routers/sessions.py`
- Session management ✓ — Anonymous sessions via X-Session-Id header
- Persistence ✓ — Full CRUD via RouteService → PostGIS
- Tests ✓ — 26 integration tests (all passing)

### Risk Assessment

**Low Risk** (1-3): Most steps, isolated changes  
**Medium Risk** (4-6): Database integrations, map modifications  
**High Risk** (7-10): None in this plan

### Testing Strategy

Each step includes:
1. Unit tests (where applicable)
2. Manual testing steps
3. Verification checklist
4. Git commit checkpoint

### Rollback Plan

If any step breaks the app:
1. `git log --oneline` to see recent commits
2. `git revert <commit-hash>` to undo
3. Fix issue in isolation
4. Re-apply when ready

---

## Next Steps

1. Review this plan
2. Set up development environment
3. Start with Phase 1.1
4. Test each step before moving forward
5. Update this document with actual time/notes

**Questions to consider**:
- Do you want user authentication before route saving?
- Should routes be public or private by default?
- Do you want GPX export in the first version?
- What's your target launch date?
