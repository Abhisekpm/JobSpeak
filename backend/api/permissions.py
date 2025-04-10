from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to view/edit it.
    Assumes the model instance has a `user` attribute.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        # if request.method in permissions.SAFE_METHODS:
        #     return True # Keep this commented out if you want STRICT ownership for GET too

        # Write permissions are only allowed to the owner of the conversation.
        # Check if the user associated with the object is the same as the user making the request.
        return obj.user == request.user 