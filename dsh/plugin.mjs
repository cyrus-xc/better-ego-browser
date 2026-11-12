import {registerEgoBrowserSkill} from './skill.mjs';
import { startBridge, requestBridge, ACTIONS } from './loopback/server.mjs';
export const name = 'ego';
export const inject = ['tools', 'skills', 'agents'];
export async function apply(ctx) {
  const { createMcpToolDefinition } = await import('@deepseek-ai/dsh-mcp-client');
  const bridge = await startBridge();
  ctx.effect(() => () => bridge.close());
  ctx.effect(() => ctx.tools.register(createMcpToolDefinition(ctx, {
    name:'ego_loopback_browser', rawName:'ego_loopback_browser',
    description:'Operate the installed official ego lite directly through this tool. The plugin host handles the official CLI, temporary scripts, browser connection and screenshot files outside the agent sandbox; call this tool without preparing files or executing shell commands. Call health first. For a read-only overview call spaces: official space summaries and recentTabTitles, not a complete tab/URL list; user spaces remain untouched. For a new goal create one uniquely named task space and reuse its spaceId and p1. Navigate/snapshot before click/fill. screenshot returns an image directly. Finish the same space once on success. Stop on user control or inactive space errors, retaining spaceId. If an operation fails or is unsupported, report it instead of requesting broader sandbox permissions.',
    inputSchema:{type:'object',properties:{action:{type:'string',enum:ACTIONS},name:{type:'string'},spaceId:{type:'integer'},url:{type:'string'},selector:{type:'string'},text:{type:'string'}},required:['action'],additionalProperties:false},
    async call(args, execution) {
      const result = await requestBridge(bridge,args,execution.signal);
      const {image,...metadata}=result;
      return {content:[{type:'text',text:JSON.stringify(metadata)},...(image?[{type:'image',data:image,mimeType:'image/png'}]:[])]};
    }
  })));
  registerEgoBrowserSkill(ctx);
}
