import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const constants = fs.readFileSync(new URL('../lib/constants/map.ts', import.meta.url), 'utf8');
const wrapper = fs.readFileSync(new URL('../components/map/map-wrapper.tsx', import.meta.url), 'utf8');
const fixed = constants.match(/\n  attribution:\s*\n\s*'([^']+)'/)[1];
// Exercise the installed bridge, rather than a copied implementation. The map,
// WebGL renderer and Leaflet registration events below are deliberate stubs;
// these checks complement, not replace, real browser lifecycle/layout tests.
const source = fs.readFileSync(require.resolve('@maplibre/maplibre-gl-leaflet'), 'utf8');
function harness(options) {
 let getters = 0;
 const events = [], sink = [], counts = new Map();
 const attributionControl = {
  addAttribution(s) { sink.push(s);counts.set(s,(counts.get(s)||0)+1); },
  removeAttribution(s) { if(counts.get(s))counts.set(s,counts.get(s)-1); }
 };
 class GL {
  constructor(o) { this.options=o;this.transform={};this._canvas={}; }
  on(name,cb) {events.push({name,cb});}
  getStyle() {getters++;return {sources:{remote:{}}};}
  getSource() {getters++;return {attribution:'<span data-sentinel="remote">REMOTE_SENTINEL</span>'};}
  _getTransformForUpdate() {return this.transform;}
  _fireMoveEvents() {}
  remove() {this.removed=true;}
 }
 const L={
  Layer:{extend(proto){ function C(o){this.options={...proto.options};this.initialize(o);}Object.assign(C.prototype,proto);return C;}},
  setOptions(obj,o){Object.assign(obj.options,o);},extend:Object.assign,
  Util:{throttle(fn){return fn;}},DomUtil:{addClass(){}},
 };
 vm.runInNewContext(source,{L,maplibregl:{Map:GL,LngLat:{convert:x=>x}}});
 const layer=L.maplibreGL(options);
 layer._container={};layer.getPaneName=()=> 'tilePane';
 layer._map={getCenter:()=>({lat:0,lng:0}),getZoom:()=>1,attributionControl,getPane:()=>({removeChild(){}})};
 return {layer,events,sink,counts,attributionControl,getters:()=>getters};
}
test('installed bridge returns fixed candidate credits before init and after repeated load without metadata reads',()=>{
 const h=harness({attributionControl:{customAttribution:fixed}});
 assert.equal(h.layer.getAttribution(),fixed);
 h.attributionControl.addAttribution(h.layer.getAttribution()); // emulate Leaflet layer registration
 h.layer._initGL();
 assert.equal(h.layer._glMap.options.attributionControl,false);
 assert.equal(h.layer.options.attributionControl.customAttribution,fixed);
 for(let i=0;i<3;i++)h.events.find(e=>e.name==='load').cb();
 assert.equal(h.layer.getAttribution(),fixed);assert.equal(h.getters(),0);
 assert.deepEqual([...h.counts.entries()],[[fixed,1]]);
 assert(h.sink.every(x=>x===fixed));
 h.layer.onRemove(h.layer._map);
 h.attributionControl.removeAttribution(h.layer.getAttribution()); // emulate Leaflet layer removal event
 assert.equal(h.counts.get(fixed),0);
 h.attributionControl.addAttribution(h.layer.getAttribution());
 h.layer._initGL();h.events.at(-1).cb();
 assert.equal(h.counts.get(fixed),1);assert.equal(h.getters(),0);
});
test('negative control proves harness exercises metadata forwarding without custom override',()=>{
 const h=harness({});h.layer._initGL();h.events[0].cb();
 assert(h.getters()>0);assert(h.sink.some(s=>s.includes('REMOTE_SENTINEL')));
});
test('candidate fixed credits retain all published provider names and only three HTTPS links',()=>{
 for(const name of ['OpenFreeMap','OpenMapTiles','OpenStreetMap'])assert(fixed.includes(name));
 const hrefs=[...fixed.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(hrefs, [
  'https://openfreemap.org',
  'https://openmaptiles.org/',
  'https://www.openstreetmap.org/copyright',
 ]);
 assert(!/<(?:script|style)|\son\w+=|javascript:/i.test(fixed));
});

test('map wrapper wires the reviewed constant into the bridge custom override', () => {
  assert.match(wrapper, /attributionControl:\s*\{\s*customAttribution:\s*MAP_TILES\.attribution\s*\}/);
});
