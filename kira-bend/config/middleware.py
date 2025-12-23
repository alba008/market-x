from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTAuthMiddleware:
    """
    Allows JWT auth for normal Django HttpRequest objects (GraphQL included).
    If Authorization: Bearer <token> is present, it sets request.user.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def __call__(self, request):
        # If already authenticated by session, leave it
        if getattr(request, "user", None) and request.user.is_authenticated:
            return self.get_response(request)

        try:
            result = self.jwt_auth.authenticate(request)
            if result is not None:
                user, token = result
                request.user = user
                request.auth = token
        except Exception:
            # If token is invalid/expired, just treat as anonymous
            pass

        return self.get_response(request)
