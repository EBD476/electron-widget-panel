const { contextBridge, ipcRenderer ,shell  } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openFileDialog: (fileName) => ipcRenderer.invoke('open-file-dialog', fileName),
  sendCurlRequest: (url) => ipcRenderer.invoke('send-curl-request', url),  
  createNote: () => ipcRenderer.invoke('create-note'),  
  getNotes:()  => ipcRenderer.invoke('get-notes'),  
  getDeployments:()  => ipcRenderer.invoke('get-deployments'), 
  readNote: (fileName) => ipcRenderer.invoke('read-note', fileName),
  saveNote: (fileName, content) => ipcRenderer.invoke('save-note', fileName, content),
  connectDb: (loc)=> ipcRenderer.invoke('connect-oracle',loc),  
  openExternal: (url) => ipcRenderer.invoke('open-browser',url),  
  runDeployment: (status,id) => ipcRenderer.invoke('run-deployment',status,id),    
  openModal: () => ipcRenderer.send('open-modal'),
  submitDeployParameter: (selectedService) => ipcRenderer.invoke('submit-deploy-parameter',selectedService),
  onModalSelection: (callback) => ipcRenderer.on('modal-selection-result', (event, value) => callback(value)),
  minimize: () => ipcRenderer.invoke('minimize'),  

});