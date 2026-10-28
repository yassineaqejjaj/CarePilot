"""Synthetic end-to-end checks for the server's local OCR and speech engines. Run inside Docker."""
from io import BytesIO
from pathlib import Path
import tempfile
import subprocess
from PIL import Image, ImageDraw, ImageFont
from app import reading, speech

image=Image.new('RGB',(1600,850),'white')
draw=ImageDraw.Draw(image)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',40)
for line,y in [('DOCUMENT FICTIF - DEMONSTRATION',80),('ATTESTATION MUTUELLE ASSURANCE',200),('PRISE EN CHARGE ADMINISTRATIVE',300),('Valable au : 01/01/2020',420)]:
    draw.text((60,y),line,fill='black',font=font)
b=BytesIO();image.save(b,format='PNG')
text,engine,score=reading.extract_text(b.getvalue(),'image/png')
report=reading.inspect_text(text,'mutuelle',engine=engine,quality=score)
assert report['detected_type']=='mutuelle',report
assert any('dépassée' in w for w in report['warnings']),report
print('Real image OCR: type and expired date detected locally.')
with tempfile.TemporaryDirectory() as tmp:
    wav=Path(tmp)/'question.wav'
    subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i',"flite=text='Where can I upload my insurance document':voice=slt",str(wav)],check=True,capture_output=True,timeout=15)
    result=speech.transcribe(wav.read_bytes())
    assert result['text'].strip(),result
    print('Real local speech: audio decoded and nonempty transcription returned; review required:',result['review_required'])
