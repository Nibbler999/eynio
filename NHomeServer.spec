Name:           NHomeServer
Version:        1.00
Release:        auto
Summary:        NHomeServer
Group:          NHomeServer
License:        GPLv3+ and MIT and ASL 2.0 and BSD and ISC
Requires:       nodejs(engine)

Source0:        %{name}.tar.gz

BuildRoot:      %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)
BuildArch:      noarch

URL:            https://nhome.ba

Requires(pre): shadow-utils
%{?systemd_requires}

BuildRequires: systemd

%description
Home server for NHome

%prep

# Extract archive and enter directory
%setup -q -n %{name}

%build
# Nothing to do

%install
rm -rf %{buildroot}

mkdir -p %{buildroot}/lib/systemd/system
mv nhomeserver.service %{buildroot}/lib/systemd/system/

mkdir -p %{buildroot}/opt/nhome
cp -pR * %{buildroot}/opt/nhome/

%clean
rm -rf %{buildroot}

%pre
getent group nhome >/dev/null || groupadd -r nhome
getent passwd nhome >/dev/null || \
    useradd -r -g nhome -s /sbin/nologin \
    -c "NHome server" nhome
exit 0

%post
%systemd_post nhomeserver.service

%preun
%systemd_preun nhomeserver.service

%postun
%systemd_postun_with_restart nhomeserver.service

%files
%attr(0755,root,root) /opt/nhome
%attr(0644,root,root) /lib/systemd/system/nhomeserver.service

%changelog
