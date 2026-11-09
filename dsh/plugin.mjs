import {createSkillProvider} from './skill-provider.mjs';
import { startBridge, requestBridge, ACTIONS } from './loopback/server.mjs';
export const name = 'ego';
export const inject = ['tools', 'skills'];
export async function apply(ctx) {
  const { createMcpToolDefinition } = await import('@deepseek-ai/dsh-mcp-client');
  const bridge = await startBridge();
  ctx.effect(() => () => bridge.close());
  ctx.effect(() => ctx.tools.register(createMcpToolDefinition(ctx, {
    name:'ego_loopback_browser', rawName:'ego_loopback_browser',
    description:'Browser-only authenticated loopback transport to the installed official ego lite. Call health first. For a read-only overview of currently open tabs call spaces: it returns official space summaries and recentTabTitles without claiming or changing user spaces; these summaries are not a complete tab/URL listing. For a new browser task create one uniquely named space and reuse its spaceId and p1 throughout the goal. Navigate/snapshot before click/fill. screenshot returns an image. Finish the same space once on success. Stop on user control or inactive space errors and retain spaceId. These operations do not require shell execution. Read the ego-browser Skill for ownership rules.',
    inputSchema:{type:'object',properties:{action:{type:'string',enum:ACTIONS},name:{type:'string'},spaceId:{type:'integer'},url:{type:'string'},selector:{type:'string'},text:{type:'string'}},required:['action'],additionalProperties:false},
    async call(args, execution) {
      const result = await requestBridge(bridge,args,execution.signal);
      const {image,...metadata}=result;
      return {content:[{type:'text',text:JSON.stringify(metadata)},...(image?[{type:'image',data:image,mimeType:'image/png'}]:[])]};
    }
  })));
  ctx.skills.registerProvider(() => createSkillProvider());
}
