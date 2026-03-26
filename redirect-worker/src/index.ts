export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Se for .pages.dev, redirecionar para framevideos.com
    if (url.hostname.includes('.pages.dev')) {
      url.hostname = 'framevideos.com';
      url.protocol = 'https:';
      
      return Response.redirect(url.toString(), 301);
    }
    
    // Redirecionar www para apex domain
    if (url.hostname === 'www.framevideos.com') {
      url.hostname = 'framevideos.com';
      
      return Response.redirect(url.toString(), 301);
    }
    
    // Passar adiante se não for redirecionamento
    return fetch(request);
  },
};
