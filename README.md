# Subsonic Run

Pulls music from your subsonic library, stitches them together into a run playlist.

Once you've got your playlist, you have two options for playing it during your run:

- Download the mp3, toss it on something that can play mp3s
- Subsonic Run can automatically save the file to your subsonic library, assuming this server has access to that physical drive.
- RSS: coming - if this server is available externally, you can subscribe using any podcast app
- Subsonic: if this server is available externally, use the LMS server config in the `docker-compose.yml` to setup a subsonic server just for your runs.
    - once the server is up, visit http://<server-ip>:5082/ and create an admin user.
    - log in, and add a music library with the path `/music`
    - select the `Scanner` from the options menu and scan the library to load all your existing runs in.
    - TBD: If you set the `LOCAL_SUBSONIC_USER` and `LOCAL_SUBSONIC_PASS` environment variables, subsonic run can poke the subsonic server to re-scan every time a new run is created.

# Installation:

## Proxmox:

instructions tbd.

## Docker:

docker-compose instructions tbd

