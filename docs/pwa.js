let installPrompt=null;
const manifest=document.querySelector('link[rel="manifest"]');
const installButton=document.querySelector("#installApp");
const isStandalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
if("serviceWorker"in navigator&&manifest){
  const manifestUrl=new URL(manifest.href);
  navigator.serviceWorker.register(new URL("service-worker.js",manifestUrl)).then(registration=>{
    registration.update().catch(()=>{});
    registration.addEventListener("updatefound",()=>{
      const newWorker=registration.installing;
      if(!newWorker)return;
      newWorker.addEventListener("statechange",()=>{
        if(newWorker.state==="installed"&&navigator.serviceWorker.controller)newWorker.postMessage({type:"SKIP_WAITING"})
      })
    })
  }).catch(error=>console.warn("No se pudo registrar el modo offline",error));
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(refreshing)return;refreshing=true;location.reload()})
}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function showIOSHelp(){const dialog=document.createElement("dialog");dialog.className="install-dialog";dialog.innerHTML='<div class="detail"><button class="dialog-close" aria-label="Cerrar">×</button><p class="kicker">Instalar en iPhone o iPad</p><h2>Crear acceso en la pantalla de inicio</h2><ol><li>Abre el menú <strong>Compartir</strong> del navegador.</li><li>Elige <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma con <strong>Añadir</strong>.</li></ol><p>La aplicación se abrirá después como una app independiente.</p></div>';document.body.append(dialog);dialog.querySelector("button").onclick=()=>dialog.close();dialog.addEventListener("close",()=>dialog.remove());dialog.showModal()}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;if(installButton&&!isStandalone)installButton.hidden=false});
window.addEventListener("appinstalled",()=>{installPrompt=null;if(installButton)installButton.hidden=true});
if(installButton&&!isStandalone&&isIOS())installButton.hidden=false;
if(installButton)installButton.addEventListener("click",async()=>{if(isIOS()&&!installPrompt)return showIOSHelp();if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installButton.hidden=true});
