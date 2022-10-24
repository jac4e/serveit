# TODO

## Pre beta launch

- [x] All todo notes in frontend templates
- [x] split frontend and backend into seperate repos

### frontend

- [x] proper feedback and bug reporting*
- [x] Product add: Coin default text should be whole number
- [x] spacing under add products in dashboard incorrect*
- [x] add "contact us" to change password or username in account view*
- [x] improve account overview view*
- [x] export buttons not matching*

- [x] alert system*
- [x] Fix double click dashboard and account nav taken to wrong place*
- [x] proper inventory handling*
  - [x] out of stock messsage on product display*

### backend

- [x] must verfiy email to ualberta.ca email
- [x] proper inventory handling*
- [x] improve configuration

### Before registration

- [x] docker compose for https
  - [x] remove web port exposure
  - [x] create nginx service with ports 80 and 443
  - [x] create mounts for nginx config and https certificates

### Finalize

- [ ] mongodb volume backup
- [x] way to verify identity of ualberta emails
- [ ] admin accounts should not be able to use the store
- [x] database volume not correctly set missing ./
- [x] deploy folder does not exist in repo
- [x] split frontend and backend into seperate parts
- [ ] Lint, spelling, format and code review!!!
- [ ] ensure all version numbers are correct
- [ ] look into caching
  - [ ] <https://restfulapi.net/caching/>
- [ ] brief documentation
- [ ] Squash entire history
- [ ] email notifications
  - [ ] notification types
    - [ ] account creation
      - [ ] registration
      - [ ] admin creation
        - [ ] randomly generated password
    - [ ] account info changed
    - [ ] account verified
    - [ ] transaction made
  - [ ] admin notifications
    - [ ] product ran out
    - [ ] daily metrics?

## Pre club demo

- [ ] better default image
- [ ] dashboard form
  - [ ] proper responsive design
  - [ ] Proper erroring
    - [x] invalid input, server errors
- [ ] Demo data generation
- [ ] add transaction type should be dropdown
- [ ] add user role should be dropdown
- [ ] improve configuration
  - [ ] branding
- [ ] add hashing to transactions
  - [ ] add verification algorithm
  - [ ] add transaction processing queue to prevent timing issues

## Pre full release

- [ ] support podman and docker
- [ ] add assistive tech compatibility
- [x] convert backend to typescript
- [x] Reload lists when item has been edited
- [ ] proper account editing
- [x] fix account export

## deploy bugs

- [x] when in slim screen mode and no products exists you are unable to open the menu
- [x] inventory on store screen is not updated when you have 0 products, add one, then go back
- [ ] button css incorrect
- [x] admin account was not set up correctly based on what was entered into the prompt (used the default email and username)

## Regular bugs

- [x] clicking on dashboard/account then going to a different submenu from default then clicking dashboard again changes router outlet but not the nav bar
- [x] two request for products when going to store page
- [x] dashboard product list doesn't update after editing product
- [x] web purchase transactions do not show in view-modal