const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {fork} = require('node:child_process');
(async () => {
 const server = fork(path.resolve(__dirname,'../scripts/serve.cjs'), ['--test'], {stdio:['ignore','inherit','inherit','ipc']});
 const artifacts = path.resolve(__dirname,'../.artifacts');
 fs.mkdirSync(artifacts,{recursive:true});
 await new Promise((resolve,reject)=>{server.once('message',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Test server exited: ${code}`)));});
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${process.env.MCE_PORT || 4174}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__mceView?.drawn,null,{timeout:120000});
  const results = await page.evaluate(()=>{
   const v=window.__mceView;
   document.getElementById('mce-go')?.click();
   v.finishIntro(true);
   v.renderer.setAnimationLoop(null);
   const render=v.ambientShading.render.bind(v.ambientShading);
   v.ambientShading.render=()=>{};
   const results={};
   function simulate(seconds,hz) {for(let n=0;n<Math.round(seconds*hz);n++) v.frame(v.last+1000/hz);}
   function reset() {v.resetInput();v.stopWalk();v.finishIntro(true);v.pace=0;v.stride=0;v.freeLook=0;}
   reset();
   const startYaw=v.yaw;
   v.move({clientX:0,clientY:0}); // Idle hover is tested through real mouse below.
   v.lookDelta=[80,25];v.freeLook=1.2;
   simulate(1,60);
   results.look={yaw:v.yaw-startYaw,pitch:v.pitch,residual:Math.hypot(...v.lookDelta)};
   const distances=[];
   for(const hz of [30,60,120]) {
    reset();const start=[...v.pos];v.keys.add('s');simulate(0.7,hz);v.keys.clear();simulate(0.5,hz);
    distances.push({hz,distance:Math.hypot(v.pos[0]-start[0],v.pos[1]-start[1]),speed:Math.hypot(...v.vel)});
   }
   results.movement=distances;
   reset(); v.keys.add('w');v.vel=[1,1];v.lookDelta=[30,20];window.dispatchEvent(new Event('blur'));
   results.blur={keys:v.keys.size,velocity:Math.hypot(...v.vel),pending:Math.hypot(...v.lookDelta)};
   reset();v.keys.add('s');const before=[...v.pos];v.frame(v.last+10000);
   results.resumeDistance=Math.hypot(v.pos[0]-before[0],v.pos[1]-before[1]);v.resetInput();
   const routes=[];
   for(const place of ['coffee','tokyo-1','open-a04']) {
    reset();v.walkToPlace(place);const length=v.track?.length;let frames=0;
    while(v.track && frames++<12000) v.frame(v.last+1000/60);
    const target=window.__mcePlaces.find(p=>p.code===place);
    routes.push({place,length,completed:!v.track,miss:Math.hypot(v.pos[0]-target.stand[0],v.pos[1]-target.stand[1])});
   }
   results.routes=routes;
   reset();v.finishIntro(true,'coffee');v.toggleProjector();simulate(5,60);
   results.projector={screen:v.office.screen.open,light:v.office.projector.on};
   v.toggleProjector();simulate(4,60);results.projector.off=v.office.screen.open===0&&v.office.projector.on===0;
   v.finishIntro(true,'tokyo-2');v.togglePartition();simulate(4,60);results.partitionOpen=v.office.partition.open;
   v.togglePartition();simulate(4,60);results.partitionClosed=v.office.partition.open;
   results.scene={shadows:!!v.office.scene.getObjectByName('office-contact-shadows'),arms:v.office.colleague.arms.length,places:window.__mcePlaces.length};
   v.ambientShading.render=render;reset();v.frame(v.last+16.667);
   return results;
  });
  console.log(JSON.stringify(results,null,2));
  assert(Math.abs(results.look.yaw+80*0.0032)<0.0001);
  assert(Math.abs(results.look.pitch+25*0.0028)<0.0001);
  assert(results.look.residual<0.001);
  assert(Math.max(...results.movement.map(x=>x.distance))-Math.min(...results.movement.map(x=>x.distance))<0.03);
  assert(results.movement.every(x=>x.distance>0.2&&x.speed<0.03));
  assert.deepEqual(results.blur,{keys:0,velocity:0,pending:0});
  assert(results.resumeDistance<0.2);
  assert(results.routes.every(x=>x.length>0&&x.completed&&x.miss<0.1));
  assert(results.projector.screen===1&&results.projector.light===1&&results.projector.off);
  assert(results.partitionOpen===1&&results.partitionClosed===0);
  assert(results.scene.shadows&&results.scene.arms===2&&results.scene.places===41);
  await page.getByTitle('Escape routes and the fastest way out from here',{exact:true}).dispatchEvent('click');
  await page.waitForFunction(()=>window.__mceView.escape() && window.__mceView.escapeInfo()?.metres > 0);
  results.escape=await page.evaluate(()=>{
    const v=window.__mceView;
    const render=v.ambientShading.render.bind(v.ambientShading);
    v.ambientShading.render=()=>{};
    v.walkOut();let steps=0;
    while(v.escaping()&&steps++<12000)v.frame(v.last+1000/60);
    v.ambientShading.render=render;
    return {completed:!v.escaping(),info:v.escapeInfo()};
  });
  assert(results.escape.completed&&results.escape.info.took>0);
  console.log('Exit route passed:', JSON.stringify(results.escape));
  // Exercise the actual DOM handlers with dispatched clicks. Simulation has
  // paused animation frames, so pointer actionability/stability timing is not
  // representative here. Rendering is checked explicitly after each mode.
  await page.getByTitle('Escape routes and the fastest way out from here',{exact:true}).dispatchEvent('click');
  await page.getByRole('button',{name:'Switch to smoother graphics'}).dispatchEvent('click');
  assert(await page.evaluate(()=>!window.__mceView.detailedGraphics&&localStorage.getItem('mce-office-graphics')==='smooth'));
  await page.evaluate(()=>window.__mceView.frame(window.__mceView.last+16.667));
  await page.getByRole('button',{name:'Switch to detailed graphics'}).dispatchEvent('click');
  assert(await page.evaluate(()=>window.__mceView.detailedGraphics));
  console.log('Both graphics modes passed');
  await page.getByTitle('Floor map (M)',{exact:true}).dispatchEvent('click');
  await page.waitForSelector('svg.minimap');
  assert(await page.locator('svg.minimap').isVisible());
  console.log('Map passed');
  await page.getByTitle('Floor map (M)',{exact:true}).dispatchEvent('click');
  await page.setViewportSize({width:960,height:640});
  await page.waitForTimeout(200);
  const size=await page.evaluate(()=>{const v=window.__mceView;return {aspect:v.camera.aspect,target:[v.ambientShading.target.width,v.ambientShading.target.height],canvas:[v.renderer.domElement.width,v.renderer.domElement.height]};});
  assert.deepEqual(size.target,size.canvas);
  assert(size.aspect>0);
  console.log('Resize passed');
  await page.setViewportSize({width:1440,height:900});
  await page.waitForTimeout(200);
  for (const place of ['welcome','coffee']) {
    await page.evaluate(place=>{const v=window.__mceView;v.finishIntro(true,place);v.frame(v.last+16.667);},place);
    await page.screenshot({path:path.join(artifacts,`${place}.png`)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,'validation.json'),JSON.stringify({results,size,errors,passed:true},null,2));
  console.log('PASS: rendering, frame-rate consistency, mouse-look, blur, resume, 3 routes, projector, partition, exit route, map and resize.');
 } catch (error) {
   console.error('Browser diagnostics:',await pageState(browser));
   throw error;
 } finally {await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function pageState(browser) {
  const page=browser.contexts()[0]?.pages()[0];
  if(!page) return null;
  return page.evaluate(()=>({text:document.body.innerText.slice(0,1200),escape:window.__mceView?.escape(),error:window.__mceView?.error(),rect:document.querySelector('button.exit')?.getBoundingClientRect().toJSON()})).catch(e=>e.message);
}
