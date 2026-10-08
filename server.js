const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const E=process.env,PORT=E.PORT||3000,PW=E.ADMIN_PASSWORD,RK=E.RESEND_API_KEY,OWNER=E.OWNER_EMAIL||"belchiorfilippo@gmail.com",TZ=E.SHOP_TZ||"America/New_York";
const DIR=E.DATA_DIR||path.join(__dirname,"data"),FILE=path.join(DIR,"data.json");
if(!PW){console.error("Missing ADMIN_PASSWORD environment variable.");process.exit(1)}
fs.mkdirSync(DIR,{recursive:true});
let D={bookings:[],blocks:[]};try{D=JSON.parse(fs.readFileSync(FILE,"utf8"))}catch(e){}
const save=()=>{fs.writeFileSync(FILE+".tmp",JSON.stringify(D));fs.renameSync(FILE+".tmp",FILE)};
const SV={haircut:{n:"Haircut",p:30},beard:{n:"Beard Trim",p:20}};
const sha=s=>crypto.createHash("sha256").update(s).digest(),SECRET=E.SESSION_SECRET||sha("s:"+PW).toString("hex");
const sign=s=>crypto.createHmac("sha256",SECRET).update(s).digest("hex");
const mkTok=()=>{const e=Date.now()+12*36e5;return e+"."+sign(""+e)};
const authed=req=>{const[e,s]=(req.headers.authorization||"").slice(7).split(".");return!!(e&&s&&s.length===64&&+e>Date.now()&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sign(e))))};
const tries={},hm=()=>new Date().toLocaleTimeString("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:false});
const ymd=ms=>new Date(ms).toLocaleDateString("en-CA",{timeZone:TZ});
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"");
const validTime=t=>/^(09|1[0-7]):(00|30)$/.test(t||"");
const valid=(d,t)=>{if(!validDate(d)||!validTime(t))return false;const today=ymd(Date.now());
if(d<today||d>ymd(Date.now()+60*864e5)||new Date(d+"T12:00:00Z").getUTCDay()===0)return false;return d>today||t>hm()};
const t12=t=>{const[h,m]=t.split(":").map(Number);return(h%12||12)+":"+String(m).padStart(2,"0")+" "+(h<12?"AM":"PM")};
async function mail(b){if(!RK)return console.log("RESEND_API_KEY not set - booking was not emailed.");
const day=new Date(b.date+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:"UTC"});
try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+RK,"Content-Type":"application/json"},body:JSON.stringify({from:"Legacy Barbershop <onboarding@resend.dev>",to:[OWNER],subject:`New booking: ${b.service} - ${day} at ${t12(b.time)}`,text:`New appointment\n\nService: ${b.service} ($${b.price})\nDate: ${day}\nTime: ${t12(b.time)}\nName: ${b.name}\nPhone: ${b.phone}`})});
if(!r.ok)console.error("Email failed:",await r.text())}catch(e){console.error("Email error:",e.message)}}
const send=(res,c,o)=>{res.writeHead(c,{"Content-Type":"application/json"});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let s="";req.on("data",c=>{s+=c;if(s.length>1e4)req.destroy()});req.on("end",()=>{try{r(JSON.parse(s||"{}"))}catch(e){r({})}})});

http.createServer(async(req,res)=>{try{
const u=req.url.split("?")[0],m=req.method;
if(m==="GET"&&(u==="/"||u==="/index.html")){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});return res.end(fs.readFileSync(path.join(__dirname,"public","index.html")))}
if(u==="/api/slots"&&m==="GET")return send(res,200,{taken:D.bookings.map(b=>b.date+"_"+b.time.replace(":","")),blocks:D.blocks});
if(u==="/api/book"&&m==="POST"){const b=await body(req),v=SV[b.service],name=String(b.name||"").trim().slice(0,80),phone=String(b.phone||"").trim().slice(0,30);
 if(!v||name.length<2||phone.replace(/\D/g,"").length<10||!valid(b.date,b.time))return send(res,400,{error:"Invalid booking details."});
 if(D.bookings.some(x=>x.date===b.date&&x.time===b.time)||D.blocks.some(x=>x.date===b.date&&(!x.time||x.time===b.time)))return send(res,409,{error:"Sorry, that time is no longer available. Please pick another."});
 const bk={id:crypto.randomUUID(),service:v.n,price:v.p,date:b.date,time:b.time,name,phone,created:new Date().toISOString()};
 D.bookings.push(bk);save();mail(bk);return send(res,200,{ok:true})}
if(u==="/api/admin/login"&&m==="POST"){const ip=(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
 const t=tries[ip]=tries[ip]&&Date.now()-tries[ip].t<9e5?tries[ip]:{n:0,t:Date.now()};
 if(t.n>=5)return send(res,429,{error:"Too many attempts."});
 const b=await body(req);if(crypto.timingSafeEqual(sha(String(b.password||"")),sha(PW)))return send(res,200,{token:mkTok()});
 t.n++;return send(res,401,{error:"Incorrect password."})}
if(u.startsWith("/api/admin/")){if(!authed(req))return send(res,401,{error:"Unauthorized"});
 if(u==="/api/admin/bookings"&&m==="GET")return send(res,200,{bookings:D.bookings});
 if(u.startsWith("/api/admin/bookings/")&&m==="DELETE"){const id=u.split("/").pop();D.bookings=D.bookings.filter(x=>x.id!==id);save();return send(res,200,{ok:true})}
 if(u==="/api/admin/block"&&m==="POST"){const b=await body(req),t=b.time||null;
  if(!validDate(b.date)||(t&&!validTime(t)))return send(res,400,{error:"Invalid date or time."});
  D.blocks=D.blocks.filter(x=>!(x.date===b.date&&(x.time||null)===t));if(b.blocked)D.blocks.push(t?{date:b.date,time:t}:{date:b.date});save();return send(res,200,{ok:true})}}
send(res,404,{error:"Not found"})}catch(e){console.error(e);send(res,500,{error:"Server error"})}}).listen(PORT,()=>console.log("Legacy Barbershop running on port "+PORT));
