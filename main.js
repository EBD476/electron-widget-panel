const { app, BrowserWindow , dialog , ipcMain , Notification ,shell  } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const oracledb = require('oracledb');
const https = require('https');
const querystring = require('querystring');

const config = require('./config.json');
let oracleConnections = config.database.oracle.connections;


let mainWindow;
let currentFile = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    // width: 300,
    width: 270,
    height: 337,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, 
      contextIsolation: true
    },
    alwaysOnTop: true,
    frame: false,
    transparent: true
  });

  // mainWindow.loadFile('index.html');
  mainWindow.loadFile('index-new.html');

  // Open the DevTools (optional)
  //  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function createModalWindow() {
  modalWindow = new BrowserWindow({
    width: 500,
    height: 150,
    // parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    alwaysOnTop: true,
    frame: false,    
  });

  modalWindow.loadFile('modal.html');

  modalWindow.once('ready-to-show', () => {
    modalWindow.show();
  });
}

function ensureNotesDir() {
  const notesDir = path.join(__dirname, 'notes');
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir);
  }
  return notesDir;
}

ipcMain.handle('open-browser', async (event, url) => {
      shell.openExternal(url)
});


ipcMain.handle('minimize', async (event, url) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.minimize();
});


ipcMain.handle('connect-oracle', async (event, loc) => {
  try {
    let connection;    
    try {      
      let idx = loc == "teh" ? 0 : 1
      console.log(loc + " - "  + idx)
      connection = await oracledb.getConnection({
        user: oracleConnections[idx].username,
        password: oracleConnections[idx].password,
        connectString: oracleConnections[idx].connectionString
      });      
      const result = await connection.execute(oracleConnections[idx].defaultQuery);      
      console.log(`Rows deleted: ${result.rowsAffected}`);
      await connection.commit();

      new Notification({
          title: 'Rows deleted',
          body: `Successfully rows deleted: ${result.rowsAffected}`,
        }).show();
      // event.sender.send('oracle-response', { 
      //   success: true, 
      //   data: result.rows,
      //   meta: result.metaData
      // });
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  } catch (err) {
          console.log(err)    
  }
});

ipcMain.handle('send-curl-request', (event, url) => {
  
       exec(`curl "${url}"`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Stderr: ${stderr}`);
          }
          console.log(`Response from ${url}: ${stdout}`);
          
            new Notification({
              title: 'URL Sent',
              body: `Successfully sent URL: ${url}`,
            }).show();            
          
        });
  });


  
ipcMain.handle('save-note', async (event, fileName, content) => {  
    // const notesDir = ensureNotesDir();  
    // const filePath = path.join(notesDir, currentFile);
    try {
        fs.writeFileSync(currentFile, content, 'utf8');
        new Notification({
              title: 'URL Sent',
              body: `Successfully saved : ${currentFile}`,
            }).show();

        return 'Saved';
    } catch (err) {
        return 'Error saving note.';
    }
});


ipcMain.handle('get-notes', async () => {
     
    const notesDir = ensureNotesDir();    
    const files = fs.readdirSync(notesDir);
    const notes = files
        .filter(file => file.endsWith('.txt'))
        .map(file => ({
          name: file,
          path: path.join(notesDir, file)
        }));        

    return notes;     
  });
  
  ipcMain.handle('run-deployment', async (event,status,processGroupId) => {
    
    const accessToken = await getNiFiAccessToken();
    // const processGroupId = "4f85a96b-0197-1000-31c1-8e983adc9aff";

    if (status == "start") {   
      const result = await runProcessGroup(accessToken, "RUNNING",processGroupId); 
      console.log(result);
      return result;     
    } else if (status == "stop") {
      const result = await runProcessGroup(accessToken, "STOPPED",processGroupId);      
      console.log(result);
      return result;
    }
    
  })
  
  ipcMain.handle('get-deployments', async () => {
    
    // Step 1: Get access token
    const accessToken = await getNiFiAccessToken();   
   // Step 2: Get process group state
    let processGroupId = "4f85a96b-0197-1000-31c1-8e983adc9aff";
    const deploy131 = await getProcessGroupState(accessToken, processGroupId);           

    processGroupId = "8fb8d9df-e54d-3ae1-5881-3e06cd938fdd";
    const deploy243 = await getProcessGroupState(accessToken, processGroupId);           

    const deployStatus = {
      deploy131 : deploy131,
      deploy243: deploy243
    }

    return deployStatus;    
  });



ipcMain.handle('open-file-dialog', (event, filePath) => {
       
      //  const filePath =   path.join(__dirname, fileName);       
      const content =  fs.readFile(filePath, 'utf-8', (err, data) => {         
        if (err) {
          dialog.showErrorBox('Error', 'Could not read the file');
          return "error";
        }

        currentFile = filePath;
         
        // Create a new window to show file content
        const fileWindow = new BrowserWindow({
          width: 950,
          height: 500,          
          modal: true,
          frame: false,    
          movable : true,      
          transparent: true, 
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
          }
        });
         
        fileWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <style>
                body {
                  margin: 5px 15px;
                  padding: 5px 20px;
                  font-family: 'ubuntu', Arial, sans-serif;
                  background-color: rgba(240, 240, 240, 0.9);
                  border-radius: 10px;
                }
                .drag-handle {
                  -webkit-app-region: drag;
                  // height: 25px;   
                  margin-bottom:10px;
                  background-color: rgba(63, 143, 67, 0.5); 
                  color:while;  
                  padding: 5px 10px ;
                  // border-radius: 5px;
                  text-align: center;
                  cursor: move;
                }
                 textarea{
                    border : 1px solid rgba(156, 156, 156, 0.5);
                  }
                button {
                  border : none;
                  padding: 5px 35px;                
                  color: rgba(43, 43, 43, 0.9);;
                  font-family: 'ubuntu', Arial, sans-serif;
                  background-color: rgba(192, 192, 192, 0.8); 
                }
            </style>
            <body style="padding: 5px; font-family: ubuntu;">
             <div class="drag-handle" >${path.basename(filePath)}</div>               
             <textarea id="file-editor" style="width: 100%; height: 84%; font-family: ubuntu;font-size:16px;font-weight:bold">${data}</textarea>              
              <div style="text-align: right;margin-top:10px;">
                <button onclick="window.close()"  >Close</button>
                <button id="save-note">Save</button>
              </div>
              <script>
              const saveBtn = document.getElementById('save-note');
              const fileEditor = document.getElementById('file-editor');
              document.getElementById('save-note').addEventListener('click', () => {
                      const content = fileEditor.value;                                                                
                      let currentFile = null;
                      window.electron.saveNote(currentFile, content).then(result => {
                        
                      });
                })                    
              </script>
            </body>
          </html>
        `);
      });
      
  return content;
});

 ipcMain.handle('submit-deploy-parameter', async (event,selectedService) => {    

    const accessToken =  await getNiFiAccessToken();      
    const processGroupId = "8fb8d9df-e54d-3ae1-5881-3e06cd938fdd"

    setProcessGroupParamater(accessToken, selectedService);
    const result = await runProcessGroup(accessToken,"RUNNING",processGroupId)      
    mainWindow.webContents.send('modal-selection-result', result);

  });


  ipcMain.on('open-modal', () => {    
    createModalWindow();    
  });



async function setProcessGroupParamater(token,paramValue) {

     const parameterContextId = "4f2403fb-0197-1000-482b-ac7611a4642a";
  
     const body = JSON.stringify({
      
       id: parameterContextId,
       disconnectedNodeAcknowledged: false,
       component: {
        id: parameterContextId,
        name: "servicename",
        parameters: [
          {
            parameter: {
              name: "servicename",
              value: paramValue,
              description: paramValue,
              sensitive: false
            }
          }
        ],            
        },
        revision: {
            "clientId": "246f7919-79ce-4526-9871-642f621cd41f",
            "version": 15
       },      
     });
    
     const options = {
        hostname: 'localhost',
        port: 8443,
        path: `/nifi-api/parameter-contexts/${parameterContextId}/update-requests`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`         
        },
        rejectUnauthorized: false // if using self-signed certs; remove if not needed
      };
      
     const response = await httpsRequest(options, body);      
        
     return JSON.parse(response.body);
}

async function runProcessGroup(token, state,processGroupId) { 
  
    //  const processGroupId = "4f85a96b-0197-1000-31c1-8e983adc9aff";
  
     const body = JSON.stringify({
        id: processGroupId,
        state: state,      
        // disconnectedNodeAcknowledged: false
     });
    
     const options = {
        hostname: 'localhost',
        port: 8443,
        path: `/nifi-api/flow/process-groups/${processGroupId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`         
        },
        rejectUnauthorized: false // if using self-signed certs; remove if not needed
      };
      
     const response = await httpsRequest(options, body);      
        
     return JSON.parse(response.body);
}

function getProcessGroupState(token, processGroupId) {
  
    // const processGroupId = "4f85a96b-0197-1000-31c1-8e983adc9aff";
    const options = {
        hostname: 'localhost',
        port: 8443,
        path: `/nifi-api/flow/process-groups/${processGroupId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        rejectUnauthorized: false // if using self-signed certs; remove if not needed
      };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get process group state. Status code: ${res.statusCode}`));
        res.resume();
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const flow = json.processGroupFlow.flow;
          const state = json.processGroupFlow.flow.processors[0].component.state;
          const id = json.processGroupFlow.flow.processors[0].component.parentGroupId;
          resolve({
            status : state,
            id : id
          });
        } catch (err) {
          reject(new Error('Failed to parse process group state JSON: ' + err.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

function getNiFiAccessToken(){
  
      const postData = querystring.stringify({
        username: 'c06ed96f-db70-458f-aba9-1cd3b0a39a98',
        password: 'Y+Y6LOV2xcFQEaP3bQf7wEkoECsijLqA'
      });

        const options = {
        hostname: 'localhost',
        port: 8443,
        path: '/nifi-api/access/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData)
        },
         rejectUnauthorized: false // Set to true if you have valid SSL certs
      };

  return new Promise((resolve, reject) => {

      const req = https.request(options, (res) => {
        let data = '';
        
        if (res.statusCode !== 201  ) {
          callback(new Error(`Failed to get token. Status code: ${res.statusCode}`));
          res.resume();
          return;
        }

       
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data.trim());
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}


/**
 * Helper function to make HTTPS requests
 */
function httpsRequest(options, postData = null) {
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
        
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {        
        if (res.statusCode >= 200 && res.statusCode < 300) {                
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Function to format current date/time as YYYYMMDD_HHMMSS
function getFormattedDate() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}


ipcMain.handle('create-note', (event) => {
  
    const notesDir = ensureNotesDir();
    // const noteId = uuidv4();
    const dateStr = getFormattedDate();
    const notePath = path.join(notesDir, `note_${dateStr}.txt`);
    const defaultContent = `New Note ${new Date().toLocaleString()}\n\nStart writing here...`;
    
    fs.writeFile(notePath, defaultContent, (err) => {
      if (err) {
        event.sender.send('note-created', { error: err.message });
        return;
      }
      event.sender.send('note-created', { 
        success: true,
        // fileName: `note_${noteId}.txt`,
        fileName : `note_${dateStr}.txt`,
        filePath: notePath
      });
    });
  });


// Function to read file and show content
function showFileContent() {

  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
          dialog.showErrorBox('Error', 'Could not read the file');
          return;
        }
        
        // Create a new window to show file content
        const fileWindow = new BrowserWindow({
          width: 600,
          height: 400,
          parent: mainWindow,
          modal: true,          
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });
        
        fileWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <body style="padding: 10px; font-family: Arial;">
              // <h2>File Content: ${path.basename(filePath)}</h2>
              <textarea style="width: 100%; height: 80%; font-family: monospace;" readonly>${data.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
              <div style="text-align: right; margin-top: 10px;">
                <button onclick="window.close()" style="padding: 5px 15px;">Close</button>
              </div>
            </body>
          </html>
        `);
      });
    }
  }).catch(err => {
    console.log(err);
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Expose the function to the renderer
exports.showFileContent = showFileContent;
