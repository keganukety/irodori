# Future Admin Feature Notes

## HTML/CSS Partial Import

Allow admins to upload reference HTML and selectively extract only chosen CSS rules for a target iLy. component.

Examples:
- Extract `.product-price` styles and map them to iLy. price displays.
- Extract button styles, such as S/M/L option buttons, and map them to iLy. filter buttons.

This should be an assisted workflow with explicit preview and approval, not an automatic whole-page style import.

## Image Upload Optimization

Add an asset upload pipeline that keeps visual quality while reducing file size.

Future scope:
- WebP / AVIF conversion
- Loss-aware compression
- Automatic PC/SP image generation
- alt text entry
- asset_key registration

This should integrate with the existing site_assets flow rather than replacing it.
