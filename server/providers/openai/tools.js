import { createActionTools } from '../../../src/voice/actionSchemas.js';
import { ACTION_DESCRIPTIONS } from './toolDescriptions.js';

export const GEM_REALTIME_TOOLS = createActionTools(ACTION_DESCRIPTIONS);

/** @deprecated Use GEM_REALTIME_TOOLS. */
export const GEV_REALTIME_TOOLS = GEM_REALTIME_TOOLS;
