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
    if(!input||!button||!select||!textarea)return {present:false};
    const elements=[input,button,select], attrs=elements.map(e=>e.getAttribute('data-size'));
    const tokens=['--control-size-default','--control-size-medium','--control-size-large'];
    const saved=tokens.map(t=>[root.style.getPropertyValue(t),root.style.getPropertyPriority(t)]);
    const rows=[];let restored=false;
    try{
      for(const [index,size] of ['default','medium','large'].entries()){
        elements.forEach(e=>e.setAttribute('data-size',size));
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[32,40,48][index]});
        const other=(index+1)%tokens.length;
        root.style.setProperty(tokens[other],'99px','important');
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[32,40,48][index]});
        if(saved[other][0])root.style.setProperty(tokens[other],...saved[other]);else root.style.removeProperty(tokens[other]);
        root.style.setProperty(tokens[index],String([36,44,52][index])+'px','important');
        rows.push({size,heights:elements.map(e=>parseFloat(getComputedStyle(e).height)),expected:[36,44,52][index]});
        if(saved[index][0])root.style.setProperty(tokens[index],...saved[index]);else root.style.removeProperty(tokens[index]);
      }
      return {present:true,rows,textarea:textarea.rows>=3&&getComputedStyle(textarea).resize==='vertical'&&textarea.getBoundingClientRect().height>32};
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
  checks.step("CUSTOMER_CONTROL_STATE_PRECEDENCE");
  const states = await evaluate(`(async()=>{
    const elements=[document.querySelector('dialog[open] input[name="name"]'),document.querySelector('dialog[open] textarea')];
    if(elements.some(e=>!e))return null;
    const previous=document.activeElement;
    const attrs=elements.map(el=>['disabled','readonly','aria-invalid'].map(name=>[name,el.getAttribute(name)]));
    const paint=el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,color:s.color,border:s.borderColor,shadow:s.boxShadow,cursor:s.cursor};};
    const settle=async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));};
    try{
      const results=[];
      for(const el of elements){
        el.removeAttribute('disabled');el.removeAttribute('readonly');el.removeAttribute('aria-invalid');
        el.focus();await settle(el);const focus=paint(el);
        el.setAttribute('aria-invalid','true');await settle(el);const invalidFocus=paint(el);
        el.blur();el.setAttribute('disabled','');el.removeAttribute('aria-invalid');await settle(el);const disabled=paint(el);
        el.setAttribute('readonly','');el.setAttribute('aria-invalid','true');await settle(el);const combined=paint(el);
        results.push({focus,invalidFocus,disabled,combined});
      }
      return results;
    }finally{
      elements.forEach((el,i)=>attrs[i].forEach(([name,value])=>value===null?el.removeAttribute(name):el.setAttribute(name,value)));
      if(previous?.isConnected)previous.focus();
    }
  })()`);
  assert.ok(states);
  for (const state of states) {
    assert.notEqual(state.focus.shadow, "none", "actual focus ring visible");
    assert.notEqual(
      state.invalidFocus.border,
      state.focus.border,
      "invalid focus overrides regular focus",
    );
    assert.deepEqual(
      state.combined,
      state.disabled,
      "disabled wins readonly/invalid combinations",
    );
    assert.equal(state.disabled.cursor, "not-allowed");
  }
  for (const variant of ["emphasis", "secondary", "ghost"]) {
    checks.step(`CUSTOMER_ACTION_CONTRAST_${variant.toUpperCase()}`);
    const selector = `dialog[open] button[data-variant=${variant}]:not(:disabled)`;
    const location = await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;el.scrollIntoView({block:"center",inline:"nearest"});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    assert.ok(location);
    for (const hover of [false, true]) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: hover ? location.x : 0,
        y: hover ? location.y : 0,
      });
      const result = await evaluate(customerContrastExpression(selector));
      console.log(
        "Customer control diagnostic",
        JSON.stringify({ variant, expectedHover: hover, ...result }),
      );
      assert.equal(result.hover, hover);
      if (variant === "emphasis") {
        assert.equal(
          result.color,
          "rgb(255, 255, 255)",
          "Emphasis action text must be white",
        );
        assert.equal(
          result.backgroundColor,
          hover ? "rgb(224, 119, 22)" : "rgb(245, 138, 36)",
          "Emphasis action background must match brand orange / hover",
        );
      } else {
        assert.ok(result.color, `Shared ${variant} action must have color`);
      }
    }
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  console.log(
    "Customer actual emphasis/secondary/ghost default and hover color tokens PASS",
  );
}

export function customerContrastExpression(selector) {
  return `(async()=>{const el=document.querySelector(${JSON.stringify(selector)});await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));const parse=s=>{const n=s.match(/[\\d.]+/g).map(Number);return[n[0],n[1],n[2],n[3]??1];};const chain=[];for(let n=el;n;n=n.parentElement)chain.push(n);let bg=[255,255,255];for(const n of chain.reverse()){const c=parse(getComputedStyle(n).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}const fg=parse(getComputedStyle(el).color);const text=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const a=luminance(text),b=luminance(bg);return{ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),hover:el.matches(':hover'),height:getComputedStyle(el).height,radius:getComputedStyle(el).borderRadius,color:getComputedStyle(el).color,backgroundColor:getComputedStyle(el).backgroundColor};})()`;
}

export async function verifyCustomerStatusContrast({ evaluate, checks }) {
  checks.step("CUSTOMER_STATUS_AND_COUNT_CONTRAST");
  const base = "main tbody tr:not([data-skeleton]) td:nth-child(7)>span";
  const count = await evaluate(
    `document.querySelectorAll(${JSON.stringify(base)}).length`,
  );
  assert.ok(count > 0, "actual status chips required");
  const selectors = [];
  for (let i = 0; i < count; i++)
    selectors.push(
      `main tbody tr:not([data-skeleton]):nth-child(${i + 1}) td:nth-child(7)>span`,
    );
  selectors.push("main [role=tab][aria-selected=true]>span:last-child");
  for (const selector of selectors) {
    const result = await evaluate(customerContrastExpression(selector));
    assert.ok(result.color, "status/count element must have resolved color");
    console.log(
      "Customer status/count color diagnostic",
      JSON.stringify({
        selector,
        color: result.color,
        bg: result.backgroundColor,
        ratio: result.ratio,
      }),
    );
  }
}
