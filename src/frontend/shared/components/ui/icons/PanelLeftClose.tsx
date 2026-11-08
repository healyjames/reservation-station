import type { FunctionComponent } from 'preact';
import Icon, { type IconProps } from './Icon';

const PanelLeftClose: FunctionComponent<IconProps> = (props) => (
  <Icon {...props} name="panel-left-close">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </Icon>
);

export default PanelLeftClose;
