# Drop reasons

A behaviour that is not placed into a journey is **dropped**, and it leaves with one of the
reasons below.

| Line proves                                          | Why it goes                 |
| ---------------------------------------------------- | --------------------------- |
| A shape the type system or schema already guarantees | Static already holds it     |
| That a library does what the library does            | Not this repo's behaviour   |
| That specific prose or copy appears                  | Pins wording, not behaviour |
| Something a level closer to the user already proves  | Cost without confidence     |
| A bug that cannot recur                              | Maintenance without a risk  |
| Behaviour the code no longer has                     | Nothing left to protect     |
