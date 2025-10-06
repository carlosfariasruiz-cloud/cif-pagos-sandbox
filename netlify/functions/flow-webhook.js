const crypto = require('crypto');
const https = require('https');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

exports.handler = async (event) => {
  console.log('Webhook llamado');
  
  const token = event.queryStringParameters?.token;
  
  if (!token) {
    return { statusCode: 200, body: 'OK' };
  }
  
  console.log('Token:', token);
  processPayment(token).catch(err => console.error('Error:', err));
  
  return { statusCode: 200, body: 'OK' };
};

async function processPayment(token) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const params = {
      apiKey: FLOW_API_KEY,
      token: token
    };
    
    const sortedKeys = Object.keys(params).sort();
    let signString = '';
    sortedKeys.forEach(key => {
      signString += key + params[key];
    });
    
    const signature = crypto.createHmac('sha256', FLOW_SECRET).update(signString).digest('hex');
    
    let flowData = null;
    
    // Intentar POST primero
    try {
      console.log('Intentando POST...');
      const postParams = { ...params, s: signature };
      const flowParams = new URLSearchParams(postParams);
      
      const flowResponse = await fetch('https://sandbox.flow.cl/api/payment/getStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: flowParams.toString(),
        agent: httpsAgent
      });
      
      flowData = await flowResponse.json();
      console.log('POST exitoso');
    } catch (postError) {
      console.log('POST falló, intentando GET...');
      
      // Fallback a GET
      const url = `https://sandbox.flow.cl/api/payment/getStatus?apiKey=${FLOW_API_KEY}&token=${token}&s=${signature}`;
      
      const flowResponse = await fetch(url, {
        method: 'GET',
        agent: httpsAgent
      });
      
      flowData = await flowResponse.json();
      console.log('GET exitoso');
    }
    
    console.log('Flow status:', flowData.status);
    
    if (flowData.status === 2) {
      console.log('Pago aprobado');
      
      const appsScriptParams = new URLSearchParams({
        action: 'confirmarPagoFlowFromMake',
        token: token,
        flowOrder: flowData.flowOrder,
        commerceOrder: flowData.commerceOrder,
        amount: flowData.amount,
        status: flowData.status
      });
      
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: appsScriptParams.toString()
      });
      
      console.log('Apps Script actualizado');
    }
  } catch (error) {
    console.error('Error completo:', error.message);
  }
}