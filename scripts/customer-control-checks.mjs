// Actual rendered shared actions; no synthetic product controls or alternate launcher.
import assert from "node:assert/strict";
export async function verifyCustomerControls({ send, evaluate, checks }) {
  checks.step("CUSTOMER_ACTION_CONTRAST");
  await evaluate(
    "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))",
  );
  checks.step("CUSTOMER_CONTROL_SIZE_VARIANTS");
  const sizing = await evaluate(`(()=>{
    const root=document.documentElement;
    const input=document.querySelector('dialog[open] input[name="name"]');
    const button=document.querySelector('dialog[open] button[data-variant="emphasis"]');
    const select=document.querySelector('select[aria-label="Số dòng mỗi trang"]');
    const textarea=document.querySelector('dialog[open] textarea');
    const checkbox=document.querySelector('dialog[open] input[type="checkbox"]');
    if(!input||!button||!select||!textarea)return {present:false};
    const elements=[input,button,select], attrs=elements.map(e=>e.getAttribute('data-size'));
    const tokens=['--control-size-default','--control-size-medium','--control-size-large'];
    const saved=tokens.map(t=>[root.style.getPropertyValue(t),root.style.getPropertyPriority(t)]);
    const rows=[];let restored=false;
    try{
      for(const [index,size] of ['default','medium','large'].entries()){
        elements.forEach(e=>e.setAttribute('data-size',size));
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[32,40,48][index]});
        root.style.setProperty(tokens[index],String([36,44,52][index])+'px','important');
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[36,44,52][index]});
        if(saved[index][0])root.style.setProperty(tokens[index],...saved[index]);else root.style.removeProperty(tokens[index]);
      }
      return {present:true,rows,textarea:textarea.rows>=3&&getComputedStyle(textarea).resize==='vertical'&&textarea.getBoundingClientRect().height>32,checkbox:!checkbox||!!checkbox.labels?.length};
    }finally{
      elements.forEach((e,i)=>attrs[i]===null?e.removeAttribute('data-size'):e.setAttribute('data-size',attrs[i]));
      tokens.forEach((t,i)=>saved[i][0]?root.style.setProperty(t,...saved[i]):root.style.removeProperty(t));
      restored=elements.every((e,i)=>e.getAttribute('data-size')===attrs[i])&&tokens.every((t,i)=>root.style.getPropertyValue(t)===saved[i][0]&&root.style.getPropertyPriority(t)===saved[i][1]);
      if(!restored)throw Error('SIZE_OVERRIDE_RESTORATION');
    }
  })()`);
  assert.equal(sizing.present, true);
  for (const row of sizing.rows)
    for (const height of row.heights)
      assert.equal(
        height,
        row.expected,
        `real ${row.size} height and runtime override`,
      );
  assert.equal(sizing.textarea, true, "multiline Textarea rows and resize");
  assert.equal(sizing.checkbox, true, "native Checkbox label");
  for (const variant of ["emphasis", "secondary", "ghost"]) {
    const selector = `dialog[open] button[data-variant=${variant}]:not(:disabled)`;
    const location = await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    assert.ok(location);
    for (const hover of [false, true]) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: hover ? location.x : 0,
        y: hover ? location.y : 0,
      });
      const result = await evaluate(
        `(async()=>{const el=document.querySelector(${JSON.stringify(selector)});await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));const parse=s=>{const n=s.match(/[\\d.]+/g).map(Number);return[n[0],n[1],n[2],n[3]??1];};const chain=[];for(let n=el;n;n=n.parentElement)chain.push(n);let bg=[255,255,255];for(const n of chain.reverse()){const c=parse(getComputedStyle(n).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}const fg=parse(getComputedStyle(el).color);const text=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const a=luminance(text),b=luminance(bg);return{ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),hover:el.matches(':hover'),height:getComputedStyle(el).height,radius:getComputedStyle(el).borderRadius};})()`,
      );
      console.log(
        "Customer control diagnostic",
        JSON.stringify({ variant, expectedHover: hover, ...result }),
      );
      assert.equal(result.hover, hover);
      assert.ok(
        result.ratio >= 4.5,
        `Shared ${variant} action contrast must meet4.5`,
      );
    }
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  console.log(
    "Customer actual emphasis/secondary/ghost default and hover contrast PASS",
  );
}
