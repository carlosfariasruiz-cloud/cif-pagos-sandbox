const crypto = require('crypto');
const https = require('https');

const FLOW_API_KEY = '312F5DCD-BEC9-4498-A45F-6E0540LE86CE';
const FLOW_SECRET = 'b8cdacf8c7603ce55ba820e2785d751cd9eb6c63';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyj7BU8AbBj3R87GATMQ-d0jKia_OU7H9fThgXr9-GLv8A8GygwNQ8eR3CapKjOg5tT/exec';

// Agente HTTPS que acepta certificados autofirmados (solo para sandbox)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

exports.handler = async (event) => {
  console.log('Webhook llamado');
  
  const token = event.queryStringParameters?.token;
  
  if (!token) {
    return { statusCode: 200, body: 'OK' };
  }
  
  console.log('Token recibido:', token);
  
  processPayment(token).catch(err => console.error('Error:', err));
  
  return { statusCode: 200, body: 'OK' };
};

async function processPayment(token) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const signString = `apiKey${FLOW_API_KEY}token${token}`;
    const signature = crypto.createHmac('sha256', FLOW_SECRET).update(signString).digest('hex');
    
    const flowParams = new URLSearchParams({
      apiKey: FLOW_API_KEY,
      token: token,
      s: signature
    });
    
    console.log('Consultando Flow...');
    
    const flowResponse = await fetch('https://sandbox.flow.cl/api/payment/getStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: flowParams.toString(),
      agent: httpsAgent
    });
    
    const flowData = await flowResponse.json();
    console.log('Flow status:', flowData.status);
    
    if (flowData.status === 2) {
      console.log('Pago aprobado, llamando Apps Script...');
      
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
      
      console.log('Apps Script llamado exitosamente');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}