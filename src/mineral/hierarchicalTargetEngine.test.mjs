import test from 'node:test';
import assert from 'node:assert/strict';
import {refinementLevel,refineTargets} from './hierarchicalTargetEngine.js';

test('selects hierarchical refinement level',()=>{
 assert.equal(refinementLevel({score:82,confidence:70}),'LOCAL');
 assert.equal(refinementLevel({score:65,confidence:50}),'REGIONAL');
 assert.equal(refinementLevel({score:40,confidence:80}),'GLOBAL');
});

test('regional targets receive deterministic children',()=>{
 const [target]=refineTargets([{id:'T1',latitude:4,longitude:-75,score:70,confidence:50}],{maxChildren:4});
 assert.equal(target.hierarchy.children.length,4);
 assert.equal(target.hierarchy.children[0].parentId,'T1');
});
