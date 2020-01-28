const getAccessToken = (z, bundle) => {
  const promise = z.request(bundle.inputData.baseUrl+'/oauth/v2/token', {
    method: 'POST',
    body: {
      // extra data pulled from the users query string
      accountDomain: bundle.cleanedRequest.querystring.accountDomain,
      code: bundle.inputData.code,
      client_id: bundle.inputData.clientId,
      client_secret: bundle.inputData.clientSecret,
      redirect_uri: bundle.inputData.redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    }
  });

  // Needs to return at minimum, `access_token`, and if your app also does refresh, then `refresh_token` too
  return promise.then(response => {
    if (response.status !== 200) {
      throw new Error('Unable to fetch access token: ' + response.content);
    }

    const result = JSON.parse(response.content);
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token
    };
  });
};

const refreshAccessToken = (z, bundle) => {
  const promise = z.request(bundle.inputData.baseUrl+'/oauth/v2/token', {
    method: 'POST',
    body: {
      refresh_token: bundle.authData.refresh_token,
      client_id: bundle.inputData.clientId,
      client_secret: bundle.inputData.clientSecret,
      grant_type: 'refresh_token'
    },
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    }
  });

  // Needs to return `access_token`. If the refresh token stays constant, can skip it. If it changes, can
  // return it here to update the user's auth on Zapier.
  return promise.then(response => {
    if (response.status !== 200) {
      throw new Error('Unable to fetch access token: ' + response.content);
    }

    const result = JSON.parse(response.content);
    return {
      access_token: result.access_token
    };
  });
};


const testAuth = (z , bundle ) => {
  // Normally you want to make a request to an endpoint that is either specifically designed to test auth, or one that
  // every user will have access to, such as an account or profile endpoint like /me.
  const promise = z.request({
    method: 'GET',
    url: bundle.authData.baseUrl+'/api/contacts?limit=1&minimal=1',
    headers: { Authorization: 'Bearer '+bundle.authData.access_token },
  });

  // This method can return any truthy value to indicate the credentials are valid.
  // Raise an error to show
  return promise.then(response => {

    if (typeof response.json === 'undefined') {
      throw new Error('The URL you provided ('+bundle.inputData.baseUrl+') is not the base URL of a Mautic instance');
    }

    return response;
  });
};


module.exports = {
  type: 'oauth2',
  fields: [
    {key: 'clientId', type: 'string', required: true},
    {key: 'clientSecret', type: 'string', required: true},
    {key: 'baseUrl', type: 'string', required: true, helpText: 'The root URL of your Mautic installation starting with https://. E.g. https://my.mautic.net.'}
  ],
  oauth2Config: {
    // Step 1 of the OAuth flow; specify where to send the user to authenticate with your API.
    // Zapier generates the state and redirect_uri, you are responsible for providing the rest.
    // Note: can also be a function that returns a string
    authorizeUrl: {
      url: '{{bundle.inputData.baseUrl}}/oauth/v2/authorize',
      params: {
        client_id: '{{bundle.inputData.clientId}}',
        state: '{{bundle.inputData.state}}',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
        callback: '{{bundle.inputData.redirect_uri}}',
        response_type: 'code'
      }
    },
    // Step 2 of the OAuth flow; Exchange a code for an access token.
    // This could also use the request shorthand.
    getAccessToken: getAccessToken,
    // (Optional) If the access token expires after a pre-defined amount of time, you can implement
    // this method to tell Zapier how to refresh it.
    refreshAccessToken: refreshAccessToken,
    // If you want Zapier to automatically invoke `refreshAccessToken` on a 401 response, set to true
    autoRefresh: true
    // If there is a specific scope you want to limit your Zapier app to, you can define it here.
    // Will get passed along to the authorizeUrl
    // scope: 'read,write'
  },
  // The test method allows Zapier to verify that the access token is valid. We'll execute this
  // method after the OAuth flow is complete to ensure everything is setup properly.
  test: testAuth,
  // assuming "username" is a key returned from the test
  connectionLabel: '{{baseUrl}}',
};
