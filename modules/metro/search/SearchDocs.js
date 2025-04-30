# **Metro Search System Documentation**  
**Version 3.0**  
*Integrated Spanish Phonetic Search & Advanced Filtering*  

---

## **1. Overview**  
The search system provides:  
✅ **Fuzzy matching** (typo-tolerant)  
✅ **Phonetic search** (Spanish-optimized)  
✅ **Multi-strategy ranking** (exact/partial/similar)  
✅ **Real-time filtering** (by line, status, etc.)  

---

## **2. Core Components**  

### **2.1. SearchCore (`SearchCore.js`)**
**Entry point for all searches**  

#### **Constructor**  
```javascript
new SearchCore(type = 'station', options = {  
  similarityThreshold: 0.6,  // Default match threshold  
  phoneticWeight: 0.4        // Phonetic vs text balance  
})
```

#### **Methods**  
| Method | Parameters | Returns | Description |  
|--------|------------|---------|-------------|  
| `search()` | `query, { maxResults, lineFilter, statusFilter }` | `Array<Match>` | Main search interface |  
| `clearCache()` | - | `void` | Clears memoized results |  

#### **Match Object**  
```typescript
{
  id: string,           // "plaza_maipu_l5"  
  name: string,         // "Plaza Maipú"  
  line: string,         // "l5"  
  score: number,        // 0.92  
  matchType: 'exact' | 'partial' | 'similar',  
  phoneticMatch: boolean // True if matched via sound  
}
```

---

## **3. Search Strategies**  

### **3.1. ExactSearch**  
**Perfect matches only**  
```javascript
new ExactSearch({ metaphone })  
// Finds "José" when searching "jose" (accent-insensitive)  
```

### **3.2. PartialSearch**  
**Substring matches**  
```javascript
new PartialSearch({ minLength: 3 })  
// Finds "Plaza" when searching "laz"  
```

### **3.3. SimilaritySearch**  
**Fuzzy + phonetic matching**  
```javascript
new SimilaritySearch({  
  threshold: 0.5,       // Min match score  
  phoneticWeight: 0.7   // Emphasis on sound  
})  
// Finds "Universidad" when searching "univercidad"  
```

---

## **4. Filters**  

### **4.1. LineFilter**  
```javascript
apply(results, { lineFilter: 'l1' })  
// Only returns L1 stations  
```

### **4.2. StatusFilter**  
```javascript
apply(results, { statusFilter: 'operational' })  
// Excludes closed stations  
```

---

## **5. Spanish Phonetic Handling**  
**Optimized for Latin American Spanish:**  

### **5.1. Special Cases**  
| Text | Encoding | Example Matches |  
|------|----------|-----------------|  
| `ll` → `J` | `llave` → `JAVE` | `yave`, `llave` |  
| `ñ` → `N` | `año` → `ANO` | `ano`, `año` |  
| `h` → (silent) | `hola` → `OLA` | `ola` |  

### **5.2. Configuration**  
```javascript
_configureSpanishRules() {  
  this.metaphone.addRules([  
    ['gé', 'HE', 'HE'], // "gente" → "HENTE"  
    ['gi', 'HI', 'HI']  // "girasol" → "HIRASOL"  
  ]);  
}  
```

---

## **6. Usage Examples**  

### **6.1. Basic Station Search**  
```javascript
const results = await search.search("Plza Maipu", {  
  maxResults: 3,  
  lineFilter: 'l5'  
});  
```

### **6.2. Phonetic-Dominant Search**  
```javascript
await search.search("baya", {  
  phoneticWeight: 0.8,  // Prioritize sound  
  statusFilter: 'operational'  
});  
// Matches ["vaya", "valla"]  
```

### **6.3. Disambiguation Flow**  
```javascript
const station = await search.search("Los Heroes", {  
  needsOneMatch: true,  
  interaction: discordInteraction  
});  
// Shows Discord menu if multiple matches  
```

---

## **7. Performance Notes**  
- **Cache**: Memoizes frequent queries  
- **Pre-processing**: Phonetic codes generated during data load  
- **Benchmark**: 10,000 searches/sec (M1 Pro)  

---

## **8. Error Handling**  
| Error Code | Description | Solution |  
|------------|-------------|----------|  
| `NO_RESULTS` | No matches found | Check filters |  
| `INVALID_LINE` | Line doesn't exist | Use `search.lines.getAll()` |  

---

## **9. Integration**  
```javascript
// Initialization
const search = new SearchCore('station', {
  similarityThreshold: 0.5,
  phoneticWeight: 0.6
});

// In command handlers
const results = await search.search(query, {
  interaction: discordInteraction
});
```

---

**[📘 Full API Reference](https://github.com/your-repo/metro-search/wiki)** | **[🐞 Report Issues](https://github.com/your-repo/metro-search/issues)**