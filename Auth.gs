
// Can be Vertex AI service account or AI Studio API key

// AI Studio API Key
const CREDENTIALS = "AIct-YOUR-API-KEY-JEp8"

// or

// Vertex AI Service Account
const CREDENTIALS = {
  "type": "service_account",
  "project_id": "your-gcp-project-id",
  "private_key_id": "72-SOME-ID-fshjgjhsbc",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvaBWul-SOME-PRIVATE-KEY-fCKyWUp+bQ==\n-----END PRIVATE KEY-----\n",
  "client_email": "account@your-gcp-project-id.iam.gserviceaccount.com",
  "client_id": "11-SOME-CLIENT-ID-971",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-gcp-project-id.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}


/**
 * Reset the authorization state, so that it can be re-tested.
 */
function reset() {
  const service = getService();
  service.reset();
}

/**
 * Configures the service.
 */
function getService(service_account) {

  // Sets variable for service account key.
  const private_key = service_account.private_key;
  // Sets variable for service account email address.
  const client_email = service_account.client_email;


  return OAuth2.createService('GCP')
      // Set the endpoint URL.
      .setTokenUrl('https://accounts.google.com/o/oauth2/token')

      // Set the private key and issuer.
      .setPrivateKey(private_key)
      .setIssuer(client_email)

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getScriptProperties())

      // Set the scope. This must match one of the scopes configured during the
      // setup of domain-wide delegation.
      .setScope(['https://www.googleapis.com/auth/cloud-platform']);
}
