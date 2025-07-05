
// Can be Vertex AI service account or AI Studio API key

// AI Studio API Key
const CREDENTIALS = "AIzaSyyour-api-keyTEkHuOJEp8"

// or

// Vertex AI Service Account
const CREDENTIALS = {
  "type": "service_account",
  "project_id": "your-gcp-project-id",
  "private_key_id": "729b66c8e3dac4afc",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvaBWul9xyxb0a2\nTHjbfesXz/L65GFTADyddX4y0dFSmHSvDlLvlcvAd71PW9Q63nfdG3CgFuV+zC1O\nTTOv71umL3FvX3f2LKHTaEsvTTqld7lm0LbuahibZXzlCIH9isQDTFDbjcrWmQSH\nzk0PuYdtAgMBAAECggEAEph9smK/enMyV5CZY6sGwacslv1S7+/xRjt4i0F1t4go\nbQnqztD/XUXOKkX1t7qnCk3kW0sTadSRgvFcr3BZlPoT9jwsUzgfs6KC/gvK+x9j\n2zIyvAjQrHB6gUQhowYABD+b9xPPChSgnOuhmmbqIVYqfqIHTanF80hmMsIXqb1Y\n7im8Z83ihSe8f4h/ZpCqIYNYAtdN1A/1rxWyB1XB1FDHKjsTr/DwN5F9WdHc1YM5\nFKEjHXzlXCgfl6/AtsqwwlpIc6Z7itE57WjtljkNkQEKWd0KPfQBew8DhYFHXKl4\ngHZ44gaearViYZm2QPclKUgGBONzQFqj7FqX19KWuwKBgQDwq+YS5vgdamLZ4BPt\njqXW9Hy9K+Mh/7wyNZS9HAhQsMQ/P1QtB13XCEWb36aKCv0RXvuiBeNuTo109BxY\ngL3WzqlEIkHTP45QX/d1qulb5vzNexDEVRecnCkO5SYuTPyUaX0+PUoH4YCkpu76\nAKhVRqWZpayG6uBI5cJpSf+q5wKBgQDZKG8LUKEHT4nHbugTXYyCvB/atFhEDdio\nbnm3oTEm9DIro0e7kwgtQONsl9xzJ/Sl+7shrDiZvRI9jsJUJIHIOs7xE+N45mp+\n1hGDTdXps6LEw+UzbQJuxg2dUL5v0bOjVKPuAMMSiOKh3Y/2pOO2s1ZbvcLloDTU\nSruJcH7kiwKBgERrKen/vVNndhioSiIDpoO4V2nT+yskL5U6hEFKodaGmhO85ioy\n6OuDj35jk021GAKDNRf3gpNOQ4qXByPl3ZIeiCI1du8eJ1AUKB5MazDUNtQXg0m9\nQwwjnMx+Ol95RWjPoGo8NDqPUen9Bv0NiM1NWzCV17k3NnGi16TlA4jLAoGAL6RJ\nSGg2C86NYa2ZSLZbX0s6idbLDpMjF0C1f23jxLIKV7yIvkQxpQv5WRewC6uWZtvl\nYCvSdxgd6ldpluAzgOQ2Bnngi+OxNYZtbSskZRM+AIEhxbiCsh7NWdgfD5UoHgsx\ns8ODCIvzfKOJNAlU0/5gUdw95/bP4EtM/YgqrqUCgYApEGm1Hh0Q2KP7ipd39t7Y\nmqgm+7rDJ+LGTYClBgee26qDVJ2jzTekCT7JSv0aJWlg8w7yIfJaDcVvyOZ2l+I9\nzDgbEiaih4Hdl6+K8+Jt6gWo1djbtfStc3SmGC38GyiYm1SJ49b0pnGM0o1Jybqi\nCz3obm9ivknyfCKyWUp+bQ==\n-----END PRIVATE KEY-----\n",
  "client_email": "account@your-gcp-project-id.iam.gserviceaccount.com",
  "client_id": "1122929122698971",
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
