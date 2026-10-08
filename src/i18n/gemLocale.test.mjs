import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGemLocale,getGemSupportedLanguages} from './gemLocale.js';

test('country selects localized GEM locale',()=>{
 const x=resolveGemLocale({country:'CO',language:'en-US'});
 assert.equal(x.locale,'es-CO'); assert.equal(x.language,'es'); assert.equal(x.source,'country');
});
test('browser language is fallback when country is unavailable',()=>{
 const x=resolveGemLocale({language:'fr-FR'});
 assert.equal(x.locale,'fr-FR'); assert.equal(x.languageName,'Français');
});
test('language registry covers broad global language families',()=>{
 const x=getGemSupportedLanguages();
 for(const code of ['en','es','fr','ar','zh','hi','sw','am','yo','ja','ko','pt']) assert.ok(x[code]);
});

test('manual language preference overrides country suggestion',()=>{
 const x=resolveGemLocale({country:'CO',language:'fr-FR'});
 assert.equal(x.locale,'es-CO');
});
