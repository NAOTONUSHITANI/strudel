# supabase 

this folder will contain one or more supabase edge functions to talk with the database

## usage

```
pnpx supabase functions serve --no-verify-jwt # serve locally, requires docker
pnpx supabase functions deploy # deploy function(s)
```

## test

when running locally, you can test an endpoint with curl:

```sh
curl -L -X POST 'http://127.0.0.1:54321/functions/v1/hello-world' \ 
  -H 'Content-Type: application/json' \
  --data '{"foo":"bar"}'
```


