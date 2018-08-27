Upgrading from API v3
=====================

## Organisations are now Service points
The endpoint `/organisation` has been renamed to `/service_point`. This endpoint can be used to query
libraries, mobile libraries, museums and archives.

```
/service_point
/service_point/{id}
```

The separation between each type is made with property `type`.

For libraries there exists various types. Museums, archives and "anonymous" service points have one
type each.

Type    | Description
------- | -----------
archive | Archive
museum  | Museum
other   | Unspecified type

Available types for libraries are listed on the [main documentation](#fooo).

### Non-service point documents excluded
The endpoint no longer returns other types of documents such as mobile library stops, departments or
so-called meta organisations. Departments and mobile stops are now a property of the library they're
attached to.

### Regarding parameters `type` and `branch_type`
Due to the separation mentioned above, there is no longer need for a property for identifying between
different document types. Therefore the original `type` parameter/property has been dropped, and
`branch_type` has been renamed to `type`.

### Additional notes
The endpoint no more returns other types of documents such as mobile library stops, departments under
service points or so-called meta organisations.

### Different schemas
Library can be considered as a supertype of the more generic service point. (To be elaborated more.)

## Libraries
Since the main purpose of the API is to provide access to **libraries**, there is a dedicated endpoint
for querying libraries only.

```
/library
/library/{id}
```
