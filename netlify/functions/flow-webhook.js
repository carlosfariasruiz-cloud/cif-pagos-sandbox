const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

exports.handler = async (event) => {
  console.log('Webhook llamado');
  console.log('Método:', event.httpMethod);
  console.log('Body:', event.body);
  
  let token = null;
  
  // Buscar token en POST body (lo que Flow envía)
  if (event.httpMethod === 'POST' && event.body) {
    const body = querystring.parse(event.body);
    token = body.token;
    console.log('Token desde POST body:', token);
  }
  
  // Fallback: buscar en query params
  if (!token && event.queryStringParameters?.token) {
    token = event.queryStringParameters.token;
    console.log('Token desde query params:', token);
  }
  
  if (!token) {
    console.log('No se recibió token');
    return { statusCode: 200, body: 'OK' };
  }
  
  console.log('Procesando token:', token);
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
    
    console.log('Consultando Flow...');
    
    const postParams = { ...params, s: signature };
    const flowParams = new URLSearchParams(postParams);
    
    const flowResponse = await fetch('https://sandbox.flow.cl/api/payment/getStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: flowParams.toString(),
      agent: httpsAgent
    });
    
    const flowData = await flowResponse.json();
    console.log('Flow respondió:', flowData);
    
    if (flowData.status === 2) {
      console.log('Pago aprobado, actualizando...');
      
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
      
      console.log('✓ Completado');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}