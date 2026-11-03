#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function parseArgs(args) {
  const options = {file:null,title:null,description:null,styleId:null,aspectRatio:'9:16'};
  for (let i=0;i<args.length;i++) {
    const value = args[i];
    if (!value.startsWith('--') && !options.file) { options.file=value; continue; }
    const key = value.slice(2);
    const next = args[i+1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
    if (key === 'title') options.title=next;
    else if (key === 'description') options.description=next;
    else if (key === 'style') options.styleId=next;
    else if (key === 'aspect-ratio') options.aspectRatio=next;
    else throw new Error(`Unknown option --${key}`);
    i++;
  }
  if (!options.file) throw new Error('Usage: npm run submit -- ./story.docx --title "My story" --aspect-ratio 9:16 --style roblox-cinematic');
  if (!['9:16','16:9','1:1'].includes(options.aspectRatio)) throw new Error('Aspect ratio must be 9:16, 16:9 or 1:1.');
  return options;
}

async function request(url, token, body) {
  const response = await fetch(url,{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(120_000)
  });
  const payload = await response.json().catch(()=>({error:'invalid_api_response'}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error ?? 'request_failed'}: ${payload.message ?? JSON.stringify(payload)}`);
  return payload;
}

try {
  const options=parseArgs(process.argv.slice(2));
  const apiUrl=(process.env.API_BASE_URL ?? 'https://film-studio-api.onrender.com').replace(/\\/$/,'');
  const token=process.env.API_TOKEN;
  if (!token) throw new Error('Set API_TOKEN in the environment before submitting a production.');
  const filePath=resolve(options.file);
  const fileInfo=await stat(filePath);
  if (!fileInfo.isFile() || fileInfo.size===0 || fileInfo.size>5*1024*1024) throw new Error('Source must be a non-empty file no larger than 5 MB.');
  const bytes=await readFile(filePath);
  const intake=await request(`${apiUrl}/v1/intake`,token,{
    filename:basename(filePath),contentBase64:bytes.toString('base64'),
    title:options.title ?? basename(filePath).replace(/\\.[^.]+$/,''),
    description:options.description,styleId:options.styleId,aspectRatio:options.aspectRatio
  });
  const job=await request(`${apiUrl}/v1/projects/${intake.project.id}/plan`,token,{});
  process.stdout.write(JSON.stringify({project:intake.project,source:intake.source,job,deliveryEndpoint:`${apiUrl}/v1/jobs/${job.id}`},null,2)+'\\n');
} catch (error) {
  process.stderr.write(`Real Factory submission failed: ${error instanceof Error ? error.message : String(error)}\\n`);
  process.exitCode=1;
}
