# Codespace lab checker. Usage: make check LAB=<id>
# Each lab lives in labs/<id>/ and provides check.sh, which runs that lab's tests.
LAB ?=

.PHONY: check labs
check:
	@if [ -z "$(LAB)" ]; then echo "Usage: make check LAB=<id>"; $(MAKE) -s labs; exit 2; fi
	@if [ ! -x "labs/$(LAB)/check.sh" ]; then echo "No lab called '$(LAB)'."; $(MAKE) -s labs; exit 2; fi
	@cd labs/$(LAB) && ./check.sh

labs:
	@echo "Available labs:"; for d in labs/*/; do [ -x "$$d/check.sh" ] && echo "  $$(basename $$d)"; done; true
