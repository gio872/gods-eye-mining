import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiningParticipant, buildMiningParticipantNetwork, buildMiningParticipantEdges } from './globalMiningParticipants.js';

test('mining participants distinguish miner, mine and trader',()=>{
 const miner=createMiningParticipant({id:'miner-1',name:'Miner A',country:'CO',type:'MINER',commodities:['gold'],mineIds:['mine-1'],verificationStatus:'VERIFIED'});
 const mine=createMiningParticipant({id:'mine-1',name:'Mine A',country:'CO',type:'MINE',commodities:['gold'],verificationStatus:'VERIFIED'});
 const trader=createMiningParticipant({id:'trader-1',name:'Trader A',country:'UAE',type:'COMMODITY_TRADER',commodities:['gold'],mineIds:['mine-1']});
 const network=buildMiningParticipantNetwork([miner,mine,trader]);
 assert.equal(network.participantCount,3);
 assert.deepEqual(network.byMine['mine-1'],['miner-1','trader-1']);
 assert.equal(buildMiningParticipantEdges([miner,trader]).length,2);
});
