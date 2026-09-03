const patterns=[[/\b\d{8}[A-Z]\b/gi,"DNI"],[/\b[XYZ]\d{7}[A-Z]\b/gi,"NIE"],[/\bES\d{22}\b/gi,"IBAN"],[/\b(?:\+34\s*)?[6789]\d{8}\b/g,"TELÉFONO"],[/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"EMAIL"],[/\b\d{12}\b/g,"SEGURIDAD_SOCIAL"]];
export function detectSensitiveText(text){const findings=[];for(const[regex,type]of patterns){for(const match of String(text||"").matchAll(regex))findings.push({type,index:match.index,length:match[0].length})}return findings}
export function mayPublish(review){return review?.privacy_status==="ANONIMIZACION_VERIFICADA"&&review?.human_verified===1&&review?.residual_findings===0}
export function initialPrivacyStatus(kind){return kind==="pdf"?"ANONIMIZACION_PENDIENTE":"REQUIERE_REVISION"}
