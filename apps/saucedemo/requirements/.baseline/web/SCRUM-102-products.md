# SCRUM-102 — User can browse and add products

<!-- Example of a free-form developer module note. /qa-testcases turns this into structured test cases. -->

Module: Products / inventory page (`/inventory.html`), Epic: Shopping, Platform: web. Only reachable when logged in.

Dev notes:
- Shows all 6 products as cards (`data-test=inventory-item`), each with a name, price and an "Add to cart" button.
- "Add to cart" button test id is `add-to-cart-<product-name-slug>`; after clicking it becomes "Remove" (`remove-<slug>`).
- Cart icon badge (`shopping-cart-badge`) shows the number of items, hidden when the cart is empty.
- Sort dropdown (`product-sort-container`): Name (A to Z) [default], Name (Z to A), Price (low to high), Price (high to low).
