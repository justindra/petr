import * as Headless from '@headlessui/react';
import React, { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const isInternal = (href: string): boolean => href.startsWith('/') && !href.startsWith('//');

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const { href, ...rest } = props;
  if (isInternal(href)) {
    return (
      <Headless.DataInteractive>
        <RouterLink to={href} ref={ref} {...rest} />
      </Headless.DataInteractive>
    );
  }
  return (
    <Headless.DataInteractive>
      <a href={href} ref={ref} {...rest} />
    </Headless.DataInteractive>
  );
});
