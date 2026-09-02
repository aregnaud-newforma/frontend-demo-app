Imperative code says how you do something; declarative code says what you do. Prefer declarative — it reads closer to the intent.

```javascript
// BAD
function filteredAndDouble(arr, itemToFiltered) {
  return arr.reduce((prev, current) => {
    if (current === itemToFiltered) {
      return prev;
    }
    return [...prev, current * 2];
  }, []);
}
```

```javascript
// GOOD
function filteredAndDouble(arr, itemToFiltered) {
  return arr.filter((item) => item !== itemToFiltered).map((item) => item * 2);
}
```
