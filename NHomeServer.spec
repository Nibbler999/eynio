Name:           EynioConnect
Version:        1.00
Release:        auto
Summary:        EynioConnect
Group:          EynioConnect
License:        GPLv3+ and MIT and ASL 2.0 and BSD and ISC
Requires:       nodejs(engine)

Source0:        %{name}.tar.gz

BuildRoot:      %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildArch:      noarch

URL:            https://eynio.com

Requires(pre): shadow-utils
%{?systemd_requires}

BuildRequires: systemd

Provides: NHomeServer = %{version}-%{release}
Obsoletes: NHomeServer < %{version}-%{release}

%description
Eynio is a Smart Home application created for easily controlling, scheduling and
manipulating multiple smart devices. Explore the endless possibilities of your home
through our extremely easy to use app - keep connected, protected and informed.

%prep

# Extract archive and enter directory
%setup -q -n %{name}

%build
# Nothing to do

%install
rm -rf %{buildroot}

mkdir -p %{buildroot}/lib/systemd/system
mv nhomeserver.service %{buildroot}/lib/systemd/system/
mv eynioconnect.service %{buildroot}/lib/systemd/system/

mkdir -p %{buildroot}/opt/eynioconnect
cp -pR * %{buildroot}/opt/eynioconnect/

%clean
rm -rf %{buildroot}

%pre
getent group eynio >/dev/null || groupadd -r eynio
getent passwd eynio >/dev/null || \
    useradd -r -g eynio -s /sbin/nologin \
    -c "Eynio Connect" -m eynio
exit 0

%post
%systemd_post nhomeserver.service
%systemd_post eynioconnect.service

%preun
%systemd_preun nhomeserver.service
%systemd_preun eynioconnect.service

%postun
%systemd_postun_with_restart nhomeserver.service
%systemd_postun_with_restart eynioconnect.service

%files
%attr(0755,root,root) /opt/eynioconnect
%attr(0644,root,root) /lib/systemd/system/nhomeserver.service
%attr(0644,root,root) /lib/systemd/system/eynioconnect.service

%changelog
