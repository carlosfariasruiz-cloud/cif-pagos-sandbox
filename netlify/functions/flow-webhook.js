const https = require('https');
const crypto = require('crypto');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

exports.handler = async (event) => {
  // Responder OK inmediatamente
  const response = {
    statusCode: 200,
    body: 'OK'
  };
  
  const token = event.queryStringParameters?.token;
  
  if (token) {
    // Procesar en background (sin esperar)
    processPayment(token).catch(err => console.error(err));
  }
  
  return response;
};

async function processPayment(token) {
  // 1. Calcular firma
  const signString = `apiKey${FLOW_API_KEY}token${token}`;
  const signature = crypto.createHmac('sha256', FLOW_SECRET).update(signString).digest('hex');
  
  // 2. Consultar Flow
  const flowParams = `apiKey=${FLOW_API_KEY}&token=${token}&s=${signature}`;
  
  const flowData = await makeRequest('https://sandbox.flow.cl/api/payment/getStatus', flowParams);
  
  // 3. Si está aprobado (status = 2), llamar Apps Script
  if (flowData.status === 2) {
    const appsScriptParams = `action=confirmarPagoFlowFromMake&token=${token}&flowOrder=${flowData.flowOrder}&commerceOrder=${flowData.commerceOrder}&amount=${flowData.amount}&status=${flowData.status}`;
    
    await makeRequest(APPS_SCRIPT_URL, appsScriptParams);
  }
}

function makeRequest(url, params) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.length
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}