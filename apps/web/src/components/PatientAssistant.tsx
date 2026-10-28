import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mic, Send, Square, Volume2, UserRound, MessageCircle } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Button, Pill } from "@/components/ui";

type Answer={answer:string;handoff:boolean;sources:{id:string;title:string;version:number;approved_by:string}[];engine:string};
type Turn={question:string;reply:Answer};
export default function PatientAssistant({arabic=false}:{arabic?:boolean}) {
  const [lang,setLang]=useState<"fr"|"darija">(arabic?"darija":"fr");
  const [text,setText]=useState("");const [turns,setTurns]=useState<Turn[]>([]);const [recording,setRecording]=useState(false);const [error,setError]=useState("");
  const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const timer=useRef<ReturnType<typeof setTimeout>>();const bottom=useRef<HTMLDivElement>(null);
  const capabilities=useQuery({queryKey:["voice-capabilities"],queryFn:()=>api<{voice:boolean;max_seconds:number}>("/portal/assistant/capabilities")});
  const ask=useMutation({mutationFn:({question,language}:{question:string;language:string})=>api<Answer>("/portal/assistant",{method:"POST",body:JSON.stringify({message:question,language})}),
    onSuccess:(reply,v)=>{setTurns(a=>[...a,{question:v.question,reply}]);setText("");setError("");},onError:e=>setError(e instanceof ApiError?e.detail:"Connexion indisponible.")});
  const handoff=useMutation({mutationFn:(message:string)=>api("/portal/assistant/handoff",{method:"POST",body:JSON.stringify({message,language:lang})})});
  const audio=useMutation({mutationFn:(blob:Blob)=>{const body=new FormData();body.append("file",blob,"question.webm");return api<{text:string;review_required:boolean}>("/portal/assistant/transcribe",{method:"POST",body});},
    onSuccess:r=>{setText(r.text);setError(r.text?"":"Aucune parole détectée. Réessayez ou écrivez votre question.");},onError:e=>setError(e instanceof ApiError?e.detail:"Audio indisponible.")});
  useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest",behavior:"smooth"});},[turns.length]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function record(){
    if(recording){recorder.current?.stop();return;}
    setError("");
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined")throw new Error("Votre navigateur ne permet pas l'enregistrement. Écrivez votre question.");
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks:BlobPart[]=[];const r=new MediaRecorder(stream.current);recorder.current=r;
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      r.onstop=()=>{setRecording(false);if(timer.current)clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());audio.mutate(new Blob(chunks,{type:r.mimeType}));};
      r.start();setRecording(true);timer.current=setTimeout(()=>{if(r.state==="recording")r.stop();},29000);
    }catch(e){setError(e instanceof Error?e.message:"Microphone indisponible.");stream.current?.getTracks().forEach(t=>t.stop());}
  }
  function speak(answer:string){
    if(!("speechSynthesis" in window)){setError("Lecture vocale indisponible sur cet appareil.");return;}
    const voices=speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.startsWith(lang==="darija"?"ar":"fr"));
    if(!voices.length){setError("Aucune voix locale compatible installée. La réponse reste disponible à l'écrit.");return;}
    speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(answer);u.voice=voices[0];speechSynthesis.speak(u);
  }
  const dar=lang==="darija";
  return <section dir={dar?"rtl":"ltr"} aria-label="Assistant administratif" className="space-y-3 rounded-panel border border-teal-500/30 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle size={19} className="text-teal-700"/>{dar?"مساعد الإجراءات":"Votre assistant administratif"}</h2><select aria-label="Langue de l'assistant" className="rounded-ctl border border-line-strong px-2 py-1 text-sm" value={lang} onChange={e=>setLang(e.target.value as typeof lang)}><option value="fr">Français</option><option value="darija">الدارجة</option></select></div>
    <p className="text-sm text-ink-2" dir="auto">{dar?"سول على الوراق ولا الموعد. الجواب كيجي من إجراءات مصادق عليها. الأسئلة الطبية للفريق الطبي.":"Vos démarches, vos pièces, vos horaires : des réponses issues des procédures approuvées. Les questions médicales sont orientées vers votre équipe."}</p>
    <div className="max-h-[420px] space-y-4 overflow-y-auto" aria-live="polite">{turns.map((t,i)=><div key={i} className="space-y-2"><p dir="auto" className="rounded-card bg-mint-100 p-3">{t.question}</p><div className="rounded-card bg-page p-3"><p dir="auto">{t.reply.answer}</p>
      {t.reply.sources.map(s=><p key={s.id} className="mt-2 text-meta text-teal-800">Source : {s.title} · v{s.version} · {s.approved_by==="demo-reference"?"Référence de démonstration":"Approuvée par "+s.approved_by}</p>)}
      <div className="mt-2 flex flex-wrap gap-2"><button aria-label="Écouter la réponse" onClick={()=>speak(t.reply.answer)} className="inline-flex items-center gap-1 text-meta text-teal-700"><Volume2 size={14}/>{dar?"سمع الجواب":"Écouter"}</button>
      {t.reply.handoff&&<Button size="sm" variant="secondary" disabled={handoff.isPending||handoff.isSuccess} onClick={()=>handoff.mutate(t.question)}><UserRound size={14}/>{dar?"حول السؤال للفريق":"Transmettre à l'équipe"}</Button>}</div></div></div>)}<div ref={bottom}/></div>
    {turns.length===0&&<div className="flex flex-wrap gap-2">{(dar?["شنو الوراق اللي خاصني؟","كيفاش نصور الورقة؟","AMO و CNSS"]:["Comment déposer une pièce ?","Quels justificatifs AMO ?","Mon heure d'admission ?"]).map(s=><button key={s} className="rounded-full border border-line-strong px-3 py-1 text-sm" onClick={()=>setText(s)}>{s}</button>)}</div>}
    {handoff.isSuccess&&<p className="rounded-ctl bg-success-bg p-2 text-sm text-success-text">{dar?"تسيفط السؤال للفريق.":"Votre question a été transmise à l'équipe."}</p>}{handoff.isError&&<p role="alert" className="text-critical-text">Transmission impossible. Réessayez.</p>}
    <form onSubmit={e=>{e.preventDefault();if(text.trim())ask.mutate({question:text.trim(),language:lang});}} className="space-y-2">
      <textarea aria-label="Votre question" value={text} maxLength={2000} dir="auto" onChange={e=>setText(e.target.value)} placeholder={dar?"كتب السؤال ديالك…":"Écrivez votre question…"} className="min-h-20 w-full rounded-ctl border border-line-strong p-3 text-base"/>
      {audio.isSuccess&&<p className="text-meta text-ink-2">{dar?"راجع النص قبل ما تسيفطو.":"Vérifiez et corrigez la transcription avant d'envoyer."}</p>}
      <div className="flex items-center gap-2"><Button type="submit" disabled={!text.trim()||ask.isPending||recording}><Send size={15}/>{ask.isPending?"…":dar?"سيفط":"Envoyer"}</Button>
        <Button type="button" variant={recording?"danger":"secondary"} disabled={!capabilities.data?.voice||audio.isPending||ask.isPending} onClick={record}>{recording?<Square size={15}/>:<Mic size={15}/>} {recording?(dar?"وقف":"Arrêter"):audio.isPending?"…":dar?"بالصوت":"Dicter"}</Button></div>
    </form>
    <p className="text-meta text-ink-2">{capabilities.data?.voice?(dar?"الصوت كيتعالج محلياً وكيتمسح من بعد. 30 ثانية كحد أقصى.":"Transcription sur le serveur, puis suppression de l'audio. 30 secondes maximum."):dar?"الإملاء الصوتي غير متوفر دابا. كتب السؤال.":"La dictée locale est indisponible sur ce serveur. Écrivez votre question."}</p>
    {recording&&<Pill tone="critical">{dar?"كيتسجل…":"Enregistrement en cours…"}</Pill>}{error&&<p role="alert" className="text-sm text-critical-text">{error}</p>}
  </section>;
}
